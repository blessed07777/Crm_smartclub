import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Lesson, Group } from '@/types/database';
import { useAuth } from '@/stores/auth';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import AttendanceModal from '@/components/ui/AttendanceModal';
import {
  ChevronLeft, ChevronRight, Plus, ClipboardCheck, CalendarDays,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, addWeeks,
  format, isSameMonth, isSameDay, isBefore, parseISO, startOfDay, endOfDay,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import clsx from 'clsx';

type View = 'month' | 'week' | 'day';

const dayHeader = ['пн','вт','ср','чт','пт','сб','вс'];
const empty: Partial<Lesson> = { group_id: '', starts_at: '', ends_at: '', topic: '', homework: '', is_canceled: false };

function localDT(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CalendarPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';
  const [view, setView] = useState<View>('month');
  const [cursor, setCursor] = useState<Date>(new Date());
  const [filterGroup, setFilterGroup] = useState<string>('');
  const [editing, setEditing] = useState<Partial<Lesson> | null>(null);
  const [attendanceFor, setAttendanceFor] = useState<Lesson | null>(null);

  const range = useMemo(() => {
    if (view === 'month') {
      const ms = startOfMonth(cursor);
      const me = endOfMonth(cursor);
      return { from: startOfWeek(ms, { weekStartsOn: 1 }), to: endOfWeek(me, { weekStartsOn: 1 }) };
    }
    if (view === 'week') {
      return { from: startOfWeek(cursor, { weekStartsOn: 1 }), to: endOfWeek(cursor, { weekStartsOn: 1 }) };
    }
    return { from: startOfDay(cursor), to: endOfDay(cursor) };
  }, [cursor, view]);

  const lessonsQ = useQuery({
    queryKey: ['lessons-range', range.from.toISOString(), range.to.toISOString()],
    queryFn: () => api.lessons.list({ orderBy: 'starts_at', order: 'asc', limit: 1000 }),
  });
  const groupsQ = useQuery({
    queryKey: ['groups-cal', isTeacher ? user?.id : 'all'],
    queryFn: () => isTeacher
      ? api.groups.list({ limit: 1000, teacher_id: user!.id })
      : api.groups.list({ limit: 1000 }),
  });

  // For teachers: only show lessons of their own groups
  const myGroupIds = new Set((groupsQ.data || []).map(g => g.id));
  const lessons = (lessonsQ.data || []).filter(l => {
    const d = parseISO(l.starts_at);
    if (d < range.from || d > range.to) return false;
    if (isTeacher && !myGroupIds.has(l.group_id)) return false;
    if (filterGroup && l.group_id !== filterGroup) return false;
    return true;
  });

  const groupName = (id: string) => groupsQ.data?.find((g: Group) => g.id === id)?.name || 'Группа';
  const groupColor = (() => {
    // Distribute colors deterministically per group
    const palette = ['#4f46e5','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#14b8a6','#22c55e','#f43f5e','#06b6d4'];
    return (id: string) => {
      if (!id) return palette[0];
      let h = 0;
      for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
      return palette[h % palette.length];
    };
  })();

  const save = useMutation({
    mutationFn: (l: Partial<Lesson>) => {
      const payload: Partial<Lesson> = {
        ...l,
        starts_at: l.starts_at ? new Date(l.starts_at).toISOString() : undefined,
        ends_at: l.ends_at ? new Date(l.ends_at).toISOString() : undefined,
      };
      return l.id ? api.lessons.update(l.id, payload) : api.lessons.create(payload);
    },
    onSuccess: () => { toast.success('Урок сохранён'); setEditing(null); qc.invalidateQueries({ queryKey: ['lessons-range'] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.lessons.remove(id),
    onSuccess: () => { toast.success('Удалён'); setEditing(null); qc.invalidateQueries({ queryKey: ['lessons-range'] }); },
  });

  const move = (dir: -1 | 1) => {
    if (view === 'month') setCursor(c => addMonths(c, dir));
    else if (view === 'week') setCursor(c => addWeeks(c, dir));
    else setCursor(c => addDays(c, dir));
  };

  const title = view === 'month'
    ? format(cursor, 'LLLL yyyy', { locale: ru })
    : view === 'week'
    ? `${format(range.from, 'd MMM', { locale: ru })} — ${format(range.to, 'd MMM yyyy', { locale: ru })}`
    : format(cursor, 'EEEE, d MMMM yyyy', { locale: ru });

  const newLessonAt = (date: Date, hour = 10) => {
    const start = new Date(date); start.setHours(hour, 0, 0, 0);
    const end = new Date(date);   end.setHours(hour + 1, 30, 0, 0);
    setEditing({ ...empty, starts_at: localDT(start), ends_at: localDT(end) });
  };

  return (
    <div>
      <PageHeader
        title="Календарь занятий"
        subtitle="Месяц, неделя, день. Клик по уроку — отметить посещаемость."
        actions={
          <>
            <select className="input w-56" value={filterGroup} onChange={e => setFilterGroup(e.target.value)}>
              <option value="">Все группы</option>
              {(groupsQ.data || []).map((g: Group) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <button className="btn-primary" onClick={() => newLessonAt(new Date(), 10)}><Plus size={16} /> Новый урок</button>
          </>
        }
      />

      {/* Toolbar */}
      <div className="card p-3 mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button className="btn-ghost p-1.5" onClick={() => move(-1)}><ChevronLeft size={18} /></button>
          <button className="btn-ghost p-1.5" onClick={() => move(1)}><ChevronRight size={18} /></button>
          <button className="btn-secondary ml-1" onClick={() => setCursor(new Date())}>Сегодня</button>
        </div>
        <div className="flex-1 text-center text-lg font-semibold text-slate-800 capitalize">{title}</div>
        <div className="inline-flex rounded-lg overflow-hidden border border-slate-200">
          {(['month','week','day'] as View[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={clsx(
                'px-3 py-1.5 text-sm font-medium transition',
                view === v ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              {v === 'month' ? 'Месяц' : v === 'week' ? 'Неделя' : 'День'}
            </button>
          ))}
        </div>
      </div>

      {view === 'month' && (
        <MonthGrid
          cursor={cursor}
          lessons={lessons}
          groupName={groupName}
          groupColor={groupColor}
          onCellClick={d => newLessonAt(d, 10)}
          onLessonClick={l => setAttendanceFor(l)}
        />
      )}
      {view === 'week' && (
        <WeekStrip
          from={range.from}
          to={range.to}
          lessons={lessons}
          groupName={groupName}
          groupColor={groupColor}
          onCellClick={d => newLessonAt(d, 10)}
          onLessonClick={l => setAttendanceFor(l)}
        />
      )}
      {view === 'day' && (
        <DayTimeline
          day={cursor}
          lessons={lessons}
          groupName={groupName}
          groupColor={groupColor}
          onSlotClick={hour => newLessonAt(cursor, hour)}
          onLessonClick={l => setAttendanceFor(l)}
        />
      )}

      {editing && (
        <LessonModal
          value={editing}
          groups={groupsQ.data || []}
          onClose={() => setEditing(null)}
          onSave={l => save.mutate(l)}
          onDelete={() => editing.id && confirm('Удалить урок?') && del.mutate(editing.id)}
          saving={save.isPending}
        />
      )}

      {attendanceFor && (
        <AttendanceModal lesson={attendanceFor} onClose={() => setAttendanceFor(null)} />
      )}
    </div>
  );
}

function LessonChip({ lesson, color, group, onClick }: {
  lesson: Lesson; color: string; group: string; onClick: () => void;
}) {
  const past = isBefore(parseISO(lesson.ends_at), new Date());
  const start = format(parseISO(lesson.starts_at), 'HH:mm');
  const end = format(parseISO(lesson.ends_at), 'HH:mm');
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={clsx(
        'w-full text-left text-xs px-1.5 py-1 rounded border-l-4 truncate hover:opacity-80 transition',
        past ? 'bg-slate-50 text-slate-700' : 'bg-white text-slate-800',
        lesson.is_canceled && 'line-through opacity-50',
      )}
      style={{ borderLeftColor: color }}
      title={`${group} · ${lesson.topic || ''}`}
    >
      <span className="font-mono">{past ? '✓' : '📌'} {start}–{end}</span>
      <span className="ml-1 text-slate-600">{group}</span>
    </button>
  );
}

function MonthGrid({ cursor, lessons, groupName, groupColor, onCellClick, onLessonClick }: {
  cursor: Date;
  lessons: Lesson[];
  groupName: (id: string) => string;
  groupColor: (id: string) => string;
  onCellClick: (d: Date) => void;
  onLessonClick: (l: Lesson) => void;
}) {
  const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });

  const days: Date[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);

  const byDate = new Map<string, Lesson[]>();
  for (const l of lessons) {
    const k = format(parseISO(l.starts_at), 'yyyy-MM-dd');
    (byDate.get(k) || byDate.set(k, []).get(k)!).push(l);
  }
  for (const arr of byDate.values()) arr.sort((a,b) => a.starts_at.localeCompare(b.starts_at));

  const today = new Date();

  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
        {dayHeader.map(d => (
          <div key={d} className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6">
        {days.map(d => {
          const key = format(d, 'yyyy-MM-dd');
          const inMonth = isSameMonth(d, cursor);
          const isToday = isSameDay(d, today);
          const dayLessons = byDate.get(key) || [];
          return (
            <div
              key={key}
              onClick={() => onCellClick(d)}
              className={clsx(
                'border-r border-b border-slate-100 min-h-[110px] p-1.5 cursor-pointer hover:bg-slate-50/60 transition',
                !inMonth && 'bg-slate-50/40',
                isToday && 'bg-amber-50/40',
              )}
            >
              <div className={clsx(
                'text-xs font-semibold mb-1 inline-flex items-center justify-center',
                inMonth ? 'text-slate-700' : 'text-slate-400',
                isToday && 'bg-brand-600 text-white rounded-full w-5 h-5',
              )}>
                {format(d, 'd')}
              </div>
              <div className="space-y-1">
                {dayLessons.slice(0, 4).map(l => (
                  <LessonChip
                    key={l.id}
                    lesson={l}
                    color={groupColor(l.group_id)}
                    group={groupName(l.group_id)}
                    onClick={() => onLessonClick(l)}
                  />
                ))}
                {dayLessons.length > 4 && (
                  <div className="text-[10px] text-slate-500 px-1">+ ещё {dayLessons.length - 4}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekStrip({ from, to, lessons, groupName, groupColor, onCellClick, onLessonClick }: {
  from: Date; to: Date; lessons: Lesson[];
  groupName: (id: string) => string;
  groupColor: (id: string) => string;
  onCellClick: (d: Date) => void;
  onLessonClick: (l: Lesson) => void;
}) {
  const days: Date[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  const today = new Date();

  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
        {days.map(d => (
          <div key={d.toISOString()} className="px-3 py-2 text-xs font-semibold text-slate-600 uppercase tracking-wider">
            {format(d, 'EEE', { locale: ru })} <span className={clsx('ml-1', isSameDay(d, today) && 'text-brand-600')}>{format(d, 'd')}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 min-h-[480px]">
        {days.map(d => {
          const dayLessons = lessons.filter(l => isSameDay(parseISO(l.starts_at), d))
                                   .sort((a,b) => a.starts_at.localeCompare(b.starts_at));
          const isToday = isSameDay(d, today);
          return (
            <div
              key={d.toISOString()}
              onClick={() => onCellClick(d)}
              className={clsx(
                'border-r border-slate-100 p-2 cursor-pointer hover:bg-slate-50/60 transition',
                isToday && 'bg-amber-50/40',
              )}
            >
              <div className="space-y-1">
                {dayLessons.length === 0 && (
                  <div className="text-xs text-slate-300 text-center py-4">—</div>
                )}
                {dayLessons.map(l => (
                  <LessonChip
                    key={l.id}
                    lesson={l}
                    color={groupColor(l.group_id)}
                    group={groupName(l.group_id)}
                    onClick={() => onLessonClick(l)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayTimeline({ day, lessons, groupName, groupColor, onSlotClick, onLessonClick }: {
  day: Date; lessons: Lesson[];
  groupName: (id: string) => string;
  groupColor: (id: string) => string;
  onSlotClick: (hour: number) => void;
  onLessonClick: (l: Lesson) => void;
}) {
  const hours = Array.from({ length: 14 }, (_, i) => 8 + i); // 08:00 - 21:00
  const dayLessons = lessons.filter(l => isSameDay(parseISO(l.starts_at), day))
                            .sort((a,b) => a.starts_at.localeCompare(b.starts_at));

  return (
    <div className="card">
      <div className="grid grid-cols-[80px_1fr]">
        {hours.map(h => {
          const slotLessons = dayLessons.filter(l => parseISO(l.starts_at).getHours() === h);
          return (
            <div key={h} className="contents">
              <div className="border-r border-b border-slate-100 px-3 py-3 text-xs text-slate-500 font-mono">
                {String(h).padStart(2,'0')}:00
              </div>
              <div
                className="border-b border-slate-100 p-2 min-h-[60px] cursor-pointer hover:bg-slate-50/60"
                onClick={() => onSlotClick(h)}
              >
                <div className="space-y-1">
                  {slotLessons.map(l => (
                    <LessonChip
                      key={l.id}
                      lesson={l}
                      color={groupColor(l.group_id)}
                      group={groupName(l.group_id)}
                      onClick={() => onLessonClick(l)}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LessonModal({ value, groups, onClose, onSave, onDelete, saving }: {
  value: Partial<Lesson>;
  groups: Group[];
  onClose: () => void;
  onSave: (l: Partial<Lesson>) => void;
  onDelete?: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Partial<Lesson>>(value);
  return (
    <Modal open onClose={onClose}
      title={value.id ? 'Редактировать урок' : 'Новый урок'}
      footer={<>
        {value.id && onDelete && <button className="btn-danger mr-auto" onClick={onDelete}>Удалить</button>}
        <button className="btn-secondary" onClick={onClose}>Отмена</button>
        <button className="btn-primary" disabled={saving} onClick={() => onSave(form)}>Сохранить</button>
      </>}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">Группа *</label>
          <select className="input" value={form.group_id || ''} onChange={e => setForm({ ...form, group_id: e.target.value })} required>
            <option value="">—</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div><label className="label">Начало</label><input type="datetime-local" className="input" value={form.starts_at || ''} onChange={e => setForm({ ...form, starts_at: e.target.value })} /></div>
        <div><label className="label">Окончание</label><input type="datetime-local" className="input" value={form.ends_at || ''} onChange={e => setForm({ ...form, ends_at: e.target.value })} /></div>
        <div className="col-span-2"><label className="label">Тема</label><input className="input" value={form.topic || ''} onChange={e => setForm({ ...form, topic: e.target.value })} /></div>
        <div className="col-span-2"><label className="label">Домашнее задание</label><textarea className="input" rows={2} value={form.homework || ''} onChange={e => setForm({ ...form, homework: e.target.value })} /></div>
        <div className="col-span-2"><label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.is_canceled} onChange={e => setForm({ ...form, is_canceled: e.target.checked })} /> Урок отменён</label></div>
      </div>
    </Modal>
  );
}
