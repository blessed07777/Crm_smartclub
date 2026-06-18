import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, q, q1 } from './db.js';
import { runMigrations } from './migrate.js';
import { hashPassword, verifyPassword, signToken, requireAuth, requireRole } from './auth.js';

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

// ============================================================
// AUTH
// ============================================================
import { decodeToken } from './auth.js';

async function countUsers() {
  const r = await q1<{ c: number | string }>('select count(*)::int as c from users');
  return Number(r?.c ?? 0);
}

// Bootstrap probe — frontend uses it to decide whether to show public registration
app.get('/api/auth/can-register-public', async (_req, res) => {
  res.json({ allowed: (await countUsers()) === 0 });
});

app.post('/api/auth/register', async (req, res) => {
  const { email, password, full_name, role } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email и пароль обязательны' });
  if (password.length < 6) return res.status(400).json({ error: 'пароль минимум 6 символов' });
  const validRoles = ['admin', 'manager', 'teacher'];
  const r = validRoles.includes(role) ? role : 'manager';

  const hasUsers = (await countUsers()) > 0;

  // After bootstrap: only admin can register new users
  if (hasUsers) {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : '';
    try {
      const payload = decodeToken(token);
      if (payload.role !== 'admin') return res.status(403).json({ error: 'Регистрация доступна только администратору' });
    } catch {
      return res.status(403).json({ error: 'Регистрация закрыта. Обратитесь к администратору.' });
    }
  }

  const finalRole = hasUsers ? r : 'admin'; // first user is always admin

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

  // If created by admin via authenticated request — don't return a token (admin keeps own session)
  if (hasUsers) return res.json({ user });

  const token = signToken({ uid: user.id, role: user.role });
  res.json({ token, user });
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
    'select id, email, full_name, role, phone, is_active, created_at, updated_at from users where id = $1',
    [req.user!.uid],
  );
  if (!user) return res.status(404).json({ error: 'not found' });
  res.json(user);
});

app.patch('/api/auth/me', requireAuth, async (req, res) => {
  const { full_name, phone } = req.body || {};
  const user = await q1(
    `update users set full_name = coalesce($1, full_name), phone = coalesce($2, phone), updated_at = now()
     where id = $3
     returning id, email, full_name, role, phone, is_active`,
    [full_name ?? null, phone ?? null, req.user!.uid],
  );
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

function resource({ table, fields, defaultOrder = 'created_at', read = ['admin','manager','teacher'], write = ['admin','manager'] }: ResourceOpts) {
  const router = express.Router();
  router.use(requireAuth);

  router.get('/', requireRole(...read), async (req, res) => {
    const { orderBy = defaultOrder, order = 'desc', limit = '500', search, ...rest } = req.query as Record<string, string>;
    const safeOrder = order === 'asc' ? 'asc' : 'desc';
    const safeCol = fields.includes(orderBy) ? orderBy : defaultOrder;
    const where: string[] = [];
    const params: any[] = [];

    // simple eq filters: any allowed field as ?field=value
    for (const [k, v] of Object.entries(rest)) {
      if (!fields.includes(k)) continue;
      params.push(v);
      where.push(`${k} = $${params.length}`);
    }

    // ILIKE search on full_name + name + description if present
    if (search) {
      const cols = ['full_name', 'name', 'description', 'topic'].filter(c => fields.includes(c));
      if (cols.length) {
        params.push(`%${search}%`);
        where.push('(' + cols.map(c => `${c} ilike $${params.length}`).join(' or ') + ')');
      }
    }

    const lim = Math.min(Number(limit) || 500, 2000);
    const sql = `select * from ${table} ${where.length ? 'where ' + where.join(' and ') : ''}
                 order by ${safeCol} ${safeOrder} limit ${lim}`;
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
    await pool.query(`delete from ${table} where id = $1`, [req.params.id]);
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

// ============================================================
// USERS (custom — role gating, no password fields exposed)
// ============================================================
const userFields = 'id, email, full_name, role, phone, is_active, created_at, updated_at';

app.get('/api/users', requireAuth, async (_req, res) => {
  const rows = await q(`select ${userFields} from users order by created_at desc`);
  res.json(rows);
});

app.patch('/api/users/:id', requireAuth, requireRole('admin', 'manager'), async (req, res) => {
  const { full_name, phone, role, is_active } = req.body || {};
  if (role && !['admin','manager','teacher'].includes(role)) return res.status(400).json({ error: 'invalid role' });
  // Role and account-disable are admin-only
  const isAdmin = req.user?.role === 'admin';
  const safeRole = isAdmin ? (role ?? null) : null;
  const safeActive = isAdmin ? (is_active ?? null) : null;
  const row = await q1(
    `update users set
        full_name = coalesce($1, full_name),
        phone = coalesce($2, phone),
        role = coalesce($3, role),
        is_active = coalesce($4, is_active),
        updated_at = now()
     where id = $5 returning ${userFields}`,
    [full_name ?? null, phone ?? null, safeRole, safeActive, req.params.id],
  );
  res.json(row);
});

app.delete('/api/users/:id', requireAuth, requireRole('admin'), async (req, res) => {
  if (req.params.id === req.user?.uid) return res.status(400).json({ error: 'нельзя удалить самого себя' });
  await pool.query('delete from users where id = $1', [req.params.id]);
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
  const monthlyCharge = groups.reduce((s, g) => s + Number(g.monthly_fee), 0);

  const total = attendance.length;
  const presentCount = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
  const attendancePct = total ? Math.round((presentCount / total) * 100) : null;
  const scores = attendance.filter(a => a.score != null && !Number.isNaN(Number(a.score)));
  const avgScore = scores.length ? Math.round(scores.reduce((s, a) => s + Number(a.score), 0) / scores.length) : null;

  res.json({ student, groups, attendance, payments, paid, monthlyCharge, attendancePct, avgScore });
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
    [req.params.id, student_id, status, score ?? null, comment ?? null, req.user!.uid],
  );
  res.json(row);
});

// ============================================================
// DASHBOARD + REPORTS
// ============================================================
app.get('/api/dashboard/stats', requireAuth, async (_req, res) => {
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
  res.json({
    students: a,
    leads: l,
    groups: g,
    finance30: { income, expense, net: income - expense },
    upcoming: u,
    daily,
  });
});

app.get('/api/reports/monthly', requireAuth, requireRole('admin','manager'), async (_req, res) => {
  const rows = await q(
    `select to_char(date_trunc('month', paid_at), 'YYYY-MM') as month,
            sum(amount) filter (where kind = 'income')::float as income,
            sum(amount) filter (where kind in ('expense','payout','refund'))::float as expense
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
// ERROR HANDLER
// ============================================================
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('[error]', err);
  res.status(500).json({ error: err?.message || 'Internal error' });
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
