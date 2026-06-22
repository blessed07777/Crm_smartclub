import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Lesson } from '@/types/database';
import { useAuth } from '@/stores/auth';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import AttendanceModal from '@/components/ui/AttendanceModal';
import {
  GraduationCap, Users, CalendarDays, ClipboardCheck, ClipboardList,
  Clock, ArrowRight, Target,
} from 'lucide-react';
import { fmtDateTime, fmtMoney } from '@/lib/format';
import { format, parseISO, isSameDay, isToday, isBefore } from 'date-fns';
import { ru } from 'date-fns/locale';
import clsx from 'clsx';

export default function TeacherWorkspace() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ['teacher-dashboard'], queryFn: () => api.teacher.dashboard() });
  const [attendanceFor, setAttendanceFor] = useState<Lesson | null>(null);

  if (!user) return null;

  // Attendance percentage from last 30 days
  const attTotal = (data?.attendance30 || []).reduce((s, r) => s + r.n, 0);
  const attPresent = (data?.attendance30 || []).filter(r => r.status === 'present' || r.status === 'late').reduce((s, r) => s + r.n, 0);
  const attPct = attTotal ? Math.round((attPresent / attTotal) * 100) : null;

  // Week grouped by day
  const week = (data?.week || []);
  const days = Array.from(new Set(week.map(l => String(l.starts_at).slice(0, 10)))).sort();

  return (
    <div>
      <PageHeader
        title={`Здравствуйте, ${user.full_name?.split(' ')[0] || 'учитель'} 👋`}
        subtitle={user.specialty ? `Преподаватель · ${user.specialty}` : 'Кабинет преподавателя'}
        actions={<Link to="/calendar" className="btn-secondary">Полный календарь <ArrowRight size={14} /></Link>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Моих групп" value={data?.groups.length ?? '—'} icon={<GraduationCap size={20} />} tone="brand" />
        <StatCard label="Учеников всего" value={data?.studentCount ?? '—'} icon={<Users size={20} />} tone="emerald" />
        <StatCard label="Сегодня уроков" value={data?.todayLessons.length ?? '—'} icon={<CalendarDays size={20} />} tone="amber" />
        <StatCard label="Посещаемость 30 дн." value={attPct != null ? `${attPct}%` : '—'} hint={`отмечено ${attTotal} раз`} icon={<ClipboardCheck size={20} />} tone="rose" />
      </div>

      {/* Today */}
      <div className="card p-5 mb-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <CalendarDays size={18} className="text-brand-600" /> Сегодня
        </h3>
        {(data?.todayLessons || []).length === 0 ? (
          <div className="text-sm text-slate-500 py-3">Сегодня нет занятий 🌿</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {(data?.todayLessons || []).map(l => {
              const past = isBefore(parseISO(l.ends_at), new Date());
              return (
                <li key={l.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={clsx(
                      'w-12 h-12 rounded-lg flex flex-col items-center justify-center text-xs font-bold flex-shrink-0',
                      past ? 'bg-slate-100 text-slate-500' : 'bg-brand-50 text-brand-700',
                    )}>
                      <span>{format(parseISO(l.starts_at), 'HH:mm')}</span>
                      <span className="text-[10px] font-normal">{format(parseISO(l.ends_at), 'HH:mm')}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900">{l.group_name}</div>
                      <div className="text-xs text-slate-500">{l.topic || 'Без темы'}{l.is_canceled && ' · ОТМЕНЁН'}</div>
                    </div>
                  </div>
                  <button
                    className="btn-primary"
                    onClick={() => setAttendanceFor(l)}
                  >
                    <ClipboardCheck size={14} /> Отметить
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* My groups */}
        <div className="card p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><GraduationCap size={18} className="text-emerald-600" /> Мои группы</h3>
          {(data?.groups || []).length === 0 ? (
            <div className="text-sm text-slate-500">У вас пока нет групп. Обратитесь к администратору, чтобы вас закрепили за группой.</div>
          ) : (
            <ul className="space-y-3">
              {(data?.groups || []).map(g => (
                <li key={g.id} className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 last:border-0">
                  <div>
                    <div className="font-medium text-slate-900">{g.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      <span style={{ color: g.subject_color || '#6366f1' }}>●</span> {g.subject_name || 'Без предмета'}
                      {' · '}{g.students_count} учен.
                      {g.schedule_summary && ` · ${g.schedule_summary}`}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-slate-700">{fmtMoney(Number(g.monthly_fee))}/мес</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Week schedule */}
        <div className="card p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><CalendarDays size={18} className="text-brand-600" /> Ближайшая неделя</h3>
          {days.length === 0 ? (
            <div className="text-sm text-slate-500">Ближайшие 7 дней — без занятий.</div>
          ) : (
            <div className="space-y-3 max-h-[420px] overflow-y-auto">
              {days.map(d => {
                const dayLessons = week.filter(l => isSameDay(parseISO(l.starts_at), parseISO(d)));
                const dt = parseISO(d);
                return (
                  <div key={d}>
                    <div className={clsx(
                      'text-xs font-semibold uppercase tracking-wider mb-1.5',
                      isToday(dt) ? 'text-brand-700' : 'text-slate-500',
                    )}>
                      {format(dt, 'EEEE, d MMMM', { locale: ru })}{isToday(dt) && ' · сегодня'}
                    </div>
                    <ul className="space-y-1">
                      {dayLessons.map(l => (
                        <li key={l.id}>
                          <button
                            onClick={() => setAttendanceFor(l)}
                            className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-50 transition text-sm"
                          >
                            <Clock size={14} className="text-slate-400" />
                            <span className="font-mono text-slate-600 w-24">
                              {format(parseISO(l.starts_at), 'HH:mm')}–{format(parseISO(l.ends_at), 'HH:mm')}
                            </span>
                            <span className="font-medium text-slate-900 truncate">{l.group_name}</span>
                            {l.topic && <span className="text-xs text-slate-500 truncate">· {l.topic}</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* My tasks */}
      <div className="card p-5 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2"><ClipboardList size={18} className="text-violet-600" /> Мои задачи</h3>
          <Link to="/tasks" className="text-sm text-brand-600 hover:underline">Все задачи →</Link>
        </div>
        {(data?.myTasks || []).length === 0 ? (
          <div className="text-sm text-emerald-700 bg-emerald-50 rounded-lg p-3 text-center">🎉 Открытых задач нет.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {(data?.myTasks || []).map(t => {
              const overdue = !!t.due_at && isBefore(parseISO(t.due_at), new Date());
              return (
                <li key={t.id} className={clsx('py-2.5 flex items-center justify-between text-sm', overdue && 'text-rose-700')}>
                  <div className="flex items-center gap-2 min-w-0">
                    {t.kind === 'plan'
                      ? <Target size={14} className="text-violet-500 flex-shrink-0" />
                      : <ClipboardList size={14} className="text-slate-400 flex-shrink-0" />}
                    <span className="truncate">{t.title}</span>
                  </div>
                  {t.due_at && (
                    <span className={clsx('text-xs', overdue ? 'text-rose-600' : 'text-slate-500')}>
                      {fmtDateTime(t.due_at)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {attendanceFor && (
        <AttendanceModal lesson={attendanceFor} onClose={() => setAttendanceFor(null)} />
      )}
    </div>
  );
}
