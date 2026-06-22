import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, q, q1 } from './db.js';
import { runMigrations } from './migrate.js';
import {
  hashPassword, verifyPassword, signToken,
  requireAuth, requireRole, decodeToken, invalidateUserCache,
} from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 4000);
const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('select 1');
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Empty string -> NULL (so PATCH with "" doesn't blank out existing values)
const blank = (v: any) => (typeof v === 'string' && v.trim() === '') ? null : v;

// ============================================================
// AUTH
// ============================================================
async function countUsers() {
  const r = await q1<{ c: number | string }>('select count(*)::int as c from users');
  return Number(r?.c ?? 0);
}

let bootstrapLock = false;

app.get('/api/auth/can-register-public', async (_req, res) => {
  res.json({ allowed: (await countUsers()) === 0 });
});

app.post('/api/auth/register', async (req, res) => {
  const { email, password, full_name, role } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email и пароль обязательны' });
  if (password.length < 6) return res.status(400).json({ error: 'пароль минимум 6 символов' });
  if (!/^.+@.+\..+$/.test(String(email))) return res.status(400).json({ error: 'некорректный email' });
  const validRoles = ['admin', 'manager', 'teacher'];
  const r = validRoles.includes(role) ? role : 'manager';

  const hasUsers = (await countUsers()) > 0;

  if (hasUsers) {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : '';
    try {
      const payload = decodeToken(token);
      if (payload.role !== 'admin') return res.status(403).json({ error: 'Регистрация доступна только администратору' });
    } catch {
      return res.status(403).json({ error: 'Регистрация закрыта. Обратитесь к администратору.' });
    }
  } else {
    // Bootstrap race guard — only one concurrent caller wins
    if (bootstrapLock) return res.status(409).json({ error: 'Регистрация уже выполняется' });
    bootstrapLock = true;
  }

  try {
    const finalRole = hasUsers ? r : 'admin';
    const exists = await q1('select id from users where email = $1', [email.toLowerCase()]);
    if (exists) return res.status(409).json({ error: 'Пользователь с таким email уже существует' });

    const hash = await hashPassword(password);
    const user = await q1<any>(
      `insert into users (email, password_hash, full_name, role)
       values ($1, $2, $3, $4)
       returning id, email, full_name, role, phone, is_active, created_at`,
      [email.toLowerCase(), hash, full_name || email, finalRole],
    );
    if (!user) return res.status(500).json({ error: 'не удалось создать пользователя' });

    if (hasUsers) return res.json({ user });

    const tok = signToken({ uid: user.id, role: user.role });
    res.json({ token: tok, user });
  } finally {
    if (!hasUsers) bootstrapLock = false;
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email и пароль обязательны' });
  const user = await q1<any>(
    'select id, email, full_name, role, phone, is_active, password_hash from users where email = $1',
    [String(email).toLowerCase()],
  );
  if (!user) return res.status(401).json({ error: 'Неверный email или пароль' });
  if (!user.is_active) return res.status(403).json({ error: 'Аккаунт отключён' });
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Неверный email или пароль' });
  const token = signToken({ uid: user.id, role: user.role });
  delete user.password_hash;
  res.json({ token, user });
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const user = await q1(
    'select id, email, full_name, role, phone, specialty, workplace, is_active, created_at, updated_at from users where id = $1',
    [req.user!.uid],
  );
  if (!user) return res.status(404).json({ error: 'not found' });
  res.json(user);
});

app.patch('/api/auth/me', requireAuth, async (req, res) => {
  const { full_name, phone } = req.body || {};
  const user = await q1(
    `update users set
        full_name = coalesce(nullif($1, ''), full_name),
        phone     = coalesce(nullif($2, ''), phone),
        updated_at = now()
     where id = $3
     returning id, email, full_name, role, phone, specialty, workplace, is_active`,
    [blank(full_name), blank(phone), req.user!.uid],
  );
  invalidateUserCache(req.user!.uid);
  res.json(user);
});

app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!new_password || new_password.length < 6) return res.status(400).json({ error: 'пароль минимум 6 символов' });
  const u = await q1<any>('select password_hash from users where id = $1', [req.user!.uid]);
  if (!u) return res.status(404).json({ error: 'not found' });
  const ok = await verifyPassword(current_password || '', u.password_hash);
  if (!ok) return res.status(401).json({ error: 'неверный текущий пароль' });
  const hash = await hashPassword(new_password);
  await pool.query('update users set password_hash = $1 where id = $2', [hash, req.user!.uid]);
  res.json({ ok: true });
});

// ============================================================
// GENERIC CRUD FACTORY
// ============================================================
type Role = 'admin' | 'manager' | 'teacher';
interface ResourceOpts {
  table: string;
  fields: string[];
  defaultOrder?: string;
  read?: Role[];
  write?: Role[];
}

const BOOL_FIELDS = new Set(['is_active','is_canceled']);

function castParam(field: string, value: any) {
  if (BOOL_FIELDS.has(field)) {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
  }
  return value;
}

function resource({ table, fields, defaultOrder = 'created_at', read = ['admin','manager','teacher'], write = ['admin','manager'] }: ResourceOpts) {
  const router = express.Router();
  router.use(requireAuth);

  router.get('/', requireRole(...read), async (req, res) => {
    const { orderBy = defaultOrder, order = 'desc', limit = '500', search, ...rest } = req.query as Record<string, string>;
    const safeOrder = order === 'asc' ? 'asc' : 'desc';
    const safeCol = fields.includes(String(orderBy)) ? String(orderBy) : defaultOrder;
    const where: string[] = [];
    const params: any[] = [];

    for (const [k, v] of Object.entries(rest)) {
      if (!fields.includes(k)) continue;
      params.push(castParam(k, v));
      where.push(`${k} = $${params.length}`);
    }

    if (search) {
      const cols = ['full_name','name','description','topic','title'].filter(c => fields.includes(c));
      if (cols.length) {
        params.push(`%${search}%`);
        where.push('(' + cols.map(c => `${c} ilike $${params.length}`).join(' or ') + ')');
      }
    }

    const lim = Math.min(Math.max(Number(limit) || 500, 1), 2000);
    const sql = `select * from ${table} ${where.length ? 'where ' + where.join(' and ') : ''}
                 order by ${safeCol} ${safeOrder} nulls last limit ${lim}`;
    const rows = await q(sql, params);
    res.json(rows);
  });

  router.get('/:id', requireRole(...read), async (req, res) => {
    const row = await q1(`select * from ${table} where id = $1`, [req.params.id]);
    if (!row) return res.status(404).json({ error: 'not found' });
    res.json(row);
  });

  router.post('/', requireRole(...write), async (req, res) => {
    const body: Record<string, any> = req.body || {};
    const keys = Object.keys(body).filter(k => fields.includes(k));
    if (!keys.length) return res.status(400).json({ error: 'нет полей для вставки' });
    const cols = keys.join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const values = keys.map(k => body[k]);
    const row = await q1(`insert into ${table} (${cols}) values (${placeholders}) returning *`, values);
    res.json(row);
  });

  router.patch('/:id', requireRole(...write), async (req, res) => {
    const body: Record<string, any> = req.body || {};
    const keys = Object.keys(body).filter(k => fields.includes(k));
    if (!keys.length) return res.status(400).json({ error: 'нет полей для обновления' });
    const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const values = [...keys.map(k => body[k]), req.params.id];
    const row = await q1(`update ${table} set ${sets} where id = $${keys.length + 1} returning *`, values);
    if (!row) return res.status(404).json({ error: 'not found' });
    res.json(row);
  });

  router.delete('/:id', requireRole(...write), async (req, res) => {
    const result = await pool.query(`delete from ${table} where id = $1`, [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  });

  return router;
}

app.use('/api/subjects', resource({
  table: 'subjects', fields: ['name','color'],
  defaultOrder: 'name',
}));

// Auto-assign new lead to the creating manager when not specified
app.post('/api/leads', requireAuth, (req, _res, next) => {
  if (req.user?.role === 'manager' && req.body && !req.body.assigned_to) {
    req.body.assigned_to = req.user.uid;
  }
  next();
});
app.use('/api/leads', resource({
  table: 'leads',
  fields: ['full_name','phone','parent_name','parent_phone','grade','target_subjects','source','status','note','assigned_to','expected_revenue'],
  read: ['admin','manager'], write: ['admin','manager'],
}));

app.use('/api/students', resource({
  table: 'students',
  fields: ['full_name','phone','parent_name','parent_phone','grade','school','status','target_score','note','enrolled_at'],
  defaultOrder: 'full_name',
}));

app.use('/api/groups', resource({
  table: 'groups',
  fields: ['name','subject_id','teacher_id','monthly_fee','capacity','schedule_summary','starts_on','ends_on','is_active'],
}));

app.use('/api/lessons', resource({
  table: 'lessons',
  fields: ['group_id','starts_at','ends_at','topic','homework','is_canceled'],
  defaultOrder: 'starts_at',
}));

app.use('/api/payments', resource({
  table: 'payments',
  fields: ['kind','amount','currency','student_id','group_id','teacher_id','category','method','description','paid_at','created_by'],
  defaultOrder: 'paid_at',
  read: ['admin','manager'], write: ['admin','manager'],
}));

// Tasks: auto-default assigned_to and created_by; check ownership for mutations
app.post('/api/tasks', requireAuth, (req, _res, next) => {
  if (req.body) {
    if (!req.body.assigned_to) req.body.assigned_to = req.user!.uid;
    req.body.created_by = req.user!.uid;
  }
  next();
});

async function ensureTaskOwner(req: any, res: any, next: any) {
  if (req.user?.role === 'admin') return next();
  const row = await q1<{ id: string }>(
    'select id from tasks where id = $1 and (assigned_to = $2 or created_by = $2)',
    [req.params.id, req.user!.uid],
  );
  if (!row) return res.status(403).json({ error: 'Это не ваша задача' });
  next();
}
app.patch('/api/tasks/:id', requireAuth, ensureTaskOwner);
app.delete('/api/tasks/:id', requireAuth, ensureTaskOwner);

app.use('/api/tasks', resource({
  table: 'tasks',
  fields: ['title','description','kind','status','priority','due_at','assigned_to','created_by','related_type','related_id','completed_at'],
  defaultOrder: 'due_at',
  read: ['admin','manager','teacher'], write: ['admin','manager','teacher'],
}));

// ============================================================
// USERS (admin-only writes; teachers cannot edit anyone)
// ============================================================
const userFields = 'id, email, full_name, role, phone, specialty, workplace, is_active, created_at, updated_at';

app.get('/api/users', requireAuth, async (_req, res) => {
  const rows = await q(`select ${userFields} from users order by created_at desc`);
  res.json(rows);
});

app.patch('/api/users/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { full_name, phone, role, is_active, specialty, workplace, email } = req.body || {};
  if (role && !['admin','manager','teacher'].includes(role)) return res.status(400).json({ error: 'invalid role' });
  if (email && !/^.+@.+\..+$/.test(String(email))) return res.status(400).json({ error: 'некорректный email' });

  const row = await q1(
    `update users set
        full_name  = coalesce(nullif($1, ''), full_name),
        phone      = coalesce(nullif($2, ''), phone),
        role       = coalesce($3, role),
        is_active  = coalesce($4, is_active),
        specialty  = coalesce(nullif($5, ''), specialty),
        workplace  = coalesce(nullif($6, ''), workplace),
        email      = coalesce(nullif($7, ''), email),
        updated_at = now()
     where id = $8 returning ${userFields}`,
    [
      blank(full_name), blank(phone), role ?? null, is_active ?? null,
      blank(specialty), blank(workplace), email ? String(email).toLowerCase() : null,
      req.params.id,
    ],
  );
  if (!row) return res.status(404).json({ error: 'not found' });
  invalidateUserCache(req.params.id);
  res.json(row);
});

app.delete('/api/users/:id', requireAuth, requireRole('admin'), async (req, res) => {
  if (req.params.id === req.user?.uid) return res.status(400).json({ error: 'нельзя удалить самого себя' });
  const result = await pool.query('delete from users where id = $1', [req.params.id]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'not found' });
  invalidateUserCache(req.params.id);
  res.status(204).end();
});

// ============================================================
// STUDENT PROFILE (full card)
// ============================================================
app.get('/api/students/:id/profile', requireAuth, async (req, res) => {
  const id = req.params.id;
  const student = await q1<any>('select * from students where id = $1', [id]);
  if (!student) return res.status(404).json({ error: 'not found' });

  const [groups, attendance, payments] = await Promise.all([
    q<any>(
      `select g.*, sub.name as subject_name, sub.color as subject_color, u.full_name as teacher_name
       from group_students gs
       join groups g on g.id = gs.group_id
       left join subjects sub on sub.id = g.subject_id
       left join users u on u.id = g.teacher_id
       where gs.student_id = $1 order by g.name`, [id],
    ),
    q<any>(
      `select a.*, l.starts_at as lesson_at, l.topic as lesson_topic, g.name as group_name
       from attendance a
       join lessons l on l.id = a.lesson_id
       join groups g on g.id = l.group_id
       where a.student_id = $1 order by l.starts_at desc limit 100`, [id],
    ),
    q<any>('select * from payments where student_id = $1 order by paid_at desc', [id]),
  ]);

  const paid =
    payments.filter(p => p.kind === 'income').reduce((s, p) => s + Number(p.amount), 0)
    - payments.filter(p => p.kind === 'refund').reduce((s, p) => s + Number(p.amount), 0);
  const monthlyCharge = groups.reduce((s, g) => s + Number(g.monthly_fee || 0), 0);

  const total = attendance.length;
  const presentCount = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
  const attendancePct = total ? Math.round((presentCount / total) * 100) : null;
  const scores = attendance.filter(a => a.score != null && !Number.isNaN(Number(a.score)));
  const avgScore = scores.length ? Math.round(scores.reduce((s, a) => s + Number(a.score), 0) / scores.length) : null;

  res.json({ student, groups, attendance, payments, paid, monthlyCharge, attendancePct, avgScore });
});

// ============================================================
// TEACHER WORKSPACE
// ============================================================
app.get('/api/teacher/dashboard', requireAuth, async (req, res) => {
  const uid = req.user!.uid;

  const groups = await q<any>(
    `select g.id, g.name, g.monthly_fee, g.schedule_summary, g.is_active,
            sub.name as subject_name, sub.color as subject_color,
            (select count(*) from group_students where group_id = g.id)::int as students_count
     from groups g
     left join subjects sub on sub.id = g.subject_id
     where g.teacher_id = $1
     order by g.is_active desc, g.name`,
    [uid],
  );

  const groupIds = groups.map(g => g.id);

  const week = groupIds.length === 0 ? [] : await q<any>(
    `select l.*, g.name as group_name
     from lessons l
     join groups g on g.id = l.group_id
     where l.group_id = any($1::uuid[])
       and l.starts_at >= (current_date)::timestamptz
       and l.starts_at <  (current_date + interval '8 days')::timestamptz
     order by l.starts_at`,
    [groupIds],
  );

  const studentRow = groupIds.length === 0 ? null : await q1<{ c: number | string }>(
    `select count(distinct student_id)::int as c
     from group_students where group_id = any($1::uuid[])`,
    [groupIds],
  );

  const recentAttendance = groupIds.length === 0 ? [] : await q<any>(
    `select a.status, count(*)::int as n
     from attendance a
     join lessons l on l.id = a.lesson_id
     where l.group_id = any($1::uuid[])
       and l.starts_at >= now() - interval '30 days'
     group by a.status`,
    [groupIds],
  );

  const myTasks = await q<any>(
    `select id, title, due_at, priority, status, kind
     from tasks
     where assigned_to = $1 and status in ('open','in_progress')
     order by case when due_at is null then 1 else 0 end, due_at asc
     limit 6`,
    [uid],
  );

  res.json({
    groups,
    week,
    studentCount: Number(studentRow?.c ?? 0),
    attendance30: recentAttendance,
    myTasks,
  });
});

// Students visible to a teacher = those enrolled in their groups
app.get('/api/teacher/students', requireAuth, async (req, res) => {
  const uid = req.user!.uid;
  const rows = await q(
    `select distinct s.*
     from students s
     join group_students gs on gs.student_id = s.id
     join groups g on g.id = gs.group_id
     where g.teacher_id = $1
     order by s.full_name`,
    [uid],
  );
  res.json(rows);
});

// ============================================================
// MANAGER WORKSPACE
// ============================================================
app.get('/api/manager/stats', requireAuth, async (req, res) => {
  const uid = req.user!.uid;
  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

  const [byStatus, monthSummary, stale, total, recentWon] = await Promise.all([
    q<any>(
      `select status, count(*)::int as count, coalesce(sum(expected_revenue), 0)::float as value
       from leads where assigned_to = $1 group by status`, [uid],
    ),
    q1<any>(
      `select
         count(*) filter (where status = 'won')::int as won_month,
         count(*)::int as created_month,
         coalesce(sum(expected_revenue) filter (where status = 'won'), 0)::float as revenue_month
       from leads where assigned_to = $1 and created_at >= $2`, [uid, monthStart.toISOString()],
    ),
    q<any>(
      `select id, full_name, phone, status, expected_revenue, updated_at
       from leads where assigned_to = $1
         and status not in ('won', 'lost')
         and updated_at < now() - interval '3 days'
       order by updated_at asc limit 15`, [uid],
    ),
    q1<any>('select count(*)::int as total from leads where assigned_to = $1', [uid]),
    q<any>(
      `select id, full_name, phone, expected_revenue, updated_at
       from leads where assigned_to = $1 and status = 'won'
       order by updated_at desc limit 5`, [uid],
    ),
  ]);

  res.json({ byStatus, monthSummary, stale, total, recentWon });
});

// ============================================================
// GROUP ROSTER
// ============================================================
app.get('/api/groups/:id/roster', requireAuth, async (req, res) => {
  const rows = await q(
    `select s.* from group_students gs
     join students s on s.id = gs.student_id
     where gs.group_id = $1
     order by s.full_name`,
    [req.params.id],
  );
  res.json(rows);
});

app.post('/api/groups/:id/roster', requireAuth, requireRole('admin','manager'), async (req, res) => {
  const { student_id } = req.body || {};
  if (!student_id) return res.status(400).json({ error: 'student_id required' });
  await pool.query(
    `insert into group_students(group_id, student_id) values ($1, $2)
     on conflict do nothing`,
    [req.params.id, student_id],
  );
  res.status(201).json({ ok: true });
});

app.delete('/api/groups/:gid/roster/:sid', requireAuth, requireRole('admin','manager'), async (req, res) => {
  await pool.query('delete from group_students where group_id = $1 and student_id = $2', [req.params.gid, req.params.sid]);
  res.status(204).end();
});

// ============================================================
// LESSON ROSTER + ATTENDANCE
// ============================================================
app.get('/api/lessons/:id/roster', requireAuth, async (req, res) => {
  const lesson = await q1<any>('select group_id from lessons where id = $1', [req.params.id]);
  if (!lesson) return res.status(404).json({ error: 'not found' });
  const students = await q(
    `select s.* from group_students gs
     join students s on s.id = gs.student_id
     where gs.group_id = $1 order by s.full_name`,
    [lesson.group_id],
  );
  const attendance = await q('select * from attendance where lesson_id = $1', [req.params.id]);
  res.json({ students, attendance });
});

app.put('/api/lessons/:id/attendance', requireAuth, async (req, res) => {
  const { student_id, status, score, comment } = req.body || {};
  if (!student_id || !status) return res.status(400).json({ error: 'student_id и status обязательны' });
  if (!['present','absent','late','excused'].includes(status)) return res.status(400).json({ error: 'invalid status' });
  if (score != null && (typeof score !== 'number' || score < 0 || score > 100)) {
    return res.status(400).json({ error: 'оценка должна быть числом 0-100' });
  }

  // Teacher can only mark their own group's lessons
  if (req.user!.role === 'teacher') {
    const owns = await q1(
      `select 1 from lessons l
       join groups g on g.id = l.group_id
       where l.id = $1 and g.teacher_id = $2`,
      [req.params.id, req.user!.uid],
    );
    if (!owns) return res.status(403).json({ error: 'Это не ваш урок' });
  }

  const row = await q1(
    `insert into attendance (lesson_id, student_id, status, score, comment, recorded_by, recorded_at)
     values ($1, $2, $3, $4, $5, $6, now())
     on conflict (lesson_id, student_id) do update set
       status = excluded.status,
       score = excluded.score,
       comment = excluded.comment,
       recorded_by = excluded.recorded_by,
       recorded_at = excluded.recorded_at
     returning *`,
    [req.params.id, student_id, status, score ?? null, blank(comment), req.user!.uid],
  );
  res.json(row);
});

// ============================================================
// DASHBOARD + REPORTS
// ============================================================
app.get('/api/dashboard/stats', requireAuth, async (req, res) => {
  const uid = req.user!.uid;
  const sinceDate = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const [a, l, g, p, u] = await Promise.all([
    q1(`select
        count(*) filter (where status = 'active')::int as active_students,
        count(*)::int as total_students
        from students`),
    q1(`select count(*) filter (where status not in ('won','lost'))::int as open_leads,
               count(*)::int as total_leads from leads`),
    q1(`select count(*) filter (where is_active)::int as active_groups,
               count(*)::int as total_groups from groups`),
    q(`select kind, sum(amount)::float as total from payments where paid_at >= $1 group by kind`, [sinceDate]),
    q(`select id, group_id, starts_at, topic from lessons where starts_at >= now() order by starts_at limit 5`),
  ]);
  const sums: Record<string, number> = {};
  (p as any[]).forEach(r => (sums[r.kind] = Number(r.total) || 0));
  const income = sums.income || 0;
  const expense = (sums.expense || 0) + (sums.payout || 0) + (sums.refund || 0);
  const daily = await q(
    `select paid_at::date as day, kind, sum(amount)::float as total
     from payments where paid_at >= $1
     group by 1, 2 order by 1`, [sinceDate],
  );

  const myTasks = await q(
    `select id, title, due_at, priority, status, kind
     from tasks
     where assigned_to = $1 and status in ('open','in_progress')
     order by
       case when due_at is null then 1 else 0 end,
       due_at asc
     limit 8`,
    [uid],
  );
  const overdueCount = await q1<{ c: number | string }>(
    `select count(*)::int as c from tasks
     where assigned_to = $1 and status in ('open','in_progress')
     and due_at is not null and due_at < now()`,
    [uid],
  );

  res.json({
    students: a,
    leads: l,
    groups: g,
    finance30: { income, expense, net: income - expense },
    upcoming: u,
    daily,
    myTasks,
    overdueTasks: Number(overdueCount?.c ?? 0),
  });
});

app.get('/api/reports/monthly', requireAuth, requireRole('admin','manager'), async (_req, res) => {
  const rows = await q(
    `select to_char(date_trunc('month', paid_at), 'YYYY-MM') as month,
            coalesce(sum(amount) filter (where kind = 'income'), 0)::float as income,
            coalesce(sum(amount) filter (where kind in ('expense','payout','refund')), 0)::float as expense
     from payments
     where paid_at >= now() - interval '12 months'
     group by 1 order by 1`,
  );
  res.json(rows);
});

app.get('/api/reports/leads-funnel', requireAuth, requireRole('admin','manager'), async (_req, res) => {
  const rows = await q(`select status as name, count(*)::int as value from leads group by status`);
  res.json(rows);
});

app.get('/api/reports/group-revenue', requireAuth, requireRole('admin','manager'), async (_req, res) => {
  const rows = await q(
    `select g.id, g.name, g.monthly_fee,
            (select count(*) from group_students where group_id = g.id)::int as students,
            ((select count(*) from group_students where group_id = g.id) * g.monthly_fee)::float as revenue
     from groups g
     where g.is_active = true
     order by revenue desc nulls last
     limit 10`,
  );
  res.json(rows);
});

// ============================================================
// STATIC FRONTEND (production)
// ============================================================
const distPath = path.resolve(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ============================================================
// 404 + ERROR HANDLER
// ============================================================
app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: 'not found' });
});

app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('[error]', err);
  res.status(err?.status || 500).json({ error: err?.message || 'Internal error' });
});

// ============================================================
// BOOT
// ============================================================
(async () => {
  try {
    if (process.env.DATABASE_URL) await runMigrations();
    else console.warn('[boot] DATABASE_URL not set — skipping migrations');
    app.listen(PORT, () => {
      console.log(`✓ SmartClub API on http://localhost:${PORT}`);
    });
  } catch (e) {
    console.error('[boot] failed', e);
    process.exit(1);
  }
})();
