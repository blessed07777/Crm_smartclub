import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import {
  ArrowLeft, GraduationCap, Users, CalendarDays, Wallet, ClipboardList,
  Mail, Phone, Briefcase, Target, ExternalLink,
} from 'lucide-react';
import { fmtDate, fmtMoney, fmtDateTime } from '@/lib/format';
import { parseISO, isBefore } from 'date-fns';
import clsx from 'clsx';

const ROLE_LABEL: Record<string, { label: string; tone: string }> = {
  admin:   { label: 'Администратор', tone: 'badge-violet' },
  manager: { label: 'Менеджер',      tone: 'badge-blue' },
  teacher: { label: 'Преподаватель', tone: 'badge-green' },
};

const LEAD_STATUS_LABEL: Record<string, string> = {
  new: 'Новых', contacted: 'В контакте', trial: 'На пробном', negotiation: 'В переговорах', won: 'Купили', lost: 'Отказались',
};

export default function TeacherDetailPage() {
  const { id = '' } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ['user-profile', id],
    queryFn: () => api.users.profile(id),
    enabled: !!id,
  });

  if (isLoading) return <div className="text-slate-500 p-6">Загрузка…</div>;
  if (!data) return <div className="text-slate-500 p-6">Не найдено</div>;

  const u = data.user;
  const isTeacher = u.role === 'teacher';
  const isManager = u.role === 'manager';

  const totalPayouts = data.payouts.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div>
      <Link to="/teachers" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600 mb-3">
        <ArrowLeft size={14} /> К сотрудникам
      </Link>

      <PageHeader
        title={u.full_name || 'Без имени'}
        subtitle={[u.specialty, u.workplace].filter(Boolean).join(' · ')}
      />

      <div className="card p-5 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-2xl font-bold flex-shrink-0">
            {(u.full_name || '?').slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={ROLE_LABEL[u.role].tone}>{ROLE_LABEL[u.role].label}</span>
              <span className={u.is_active ? 'badge-green' : 'badge-slate'}>{u.is_active ? 'Активен' : 'Отключён'}</span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <Info icon={<Mail size={14} />} label="Email" value={u.email || '—'} />
              <Info icon={<Phone size={14} />} label="Телефон" value={u.phone || '—'} />
              <Info icon={<Target size={14} />} label="Предмет" value={u.specialty || '—'} />
              <Info icon={<Briefcase size={14} />} label="Место работы" value={u.workplace || '—'} />
              <Info label="Создан" value={fmtDate(u.created_at)} />
            </div>
          </div>
        </div>
      </div>

      {isTeacher && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Групп" value={data.groups.length} icon={<GraduationCap size={20} />} tone="brand" />
          <StatCard label="Учеников всего" value={data.studentCount} hint="уникальных" icon={<Users size={20} />} tone="emerald" />
          <StatCard label="Уроков за 30 дн." value={data.lessonStats?.past30 ?? 0} hint={`${data.lessonStats?.upcoming30 ?? 0} впереди`} icon={<CalendarDays size={20} />} tone="amber" />
          <StatCard label="Выплачено" value={fmtMoney(totalPayouts)} hint={`${data.payouts.length} операций`} icon={<Wallet size={20} />} tone="rose" />
        </div>
      )}

      {isManager && (data.leads?.length ?? 0) > 0 && (
        <div className="card p-5 mb-6">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Target size={18} className="text-brand-600" /> Лиды менеджера</h3>
          <div className="flex flex-wrap gap-2 text-sm">
            {data.leads.map(l => (
              <div key={l.status} className="bg-slate-50 rounded-lg px-3 py-2">
                <div className="text-xs font-semibold text-slate-500">{LEAD_STATUS_LABEL[l.status] || l.status}</div>
                <div className="text-lg font-bold text-slate-900">{l.count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isTeacher && (
        <div className="card mb-6">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold"><GraduationCap size={18} /> Группы преподавателя ({data.groups.length})</div>
          </div>
          {data.groups.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">Этому преподавателю пока не назначено ни одной группы.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.groups.map(g => (
                <Link to={`/groups/${g.id}`} key={g.id}
                  className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition">
                  <div>
                    <div className="font-medium text-slate-900 flex items-center gap-1">
                      {g.name} <ExternalLink size={11} className="text-slate-400" />
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      <span style={{ color: g.subject_color || '#6366f1' }}>●</span> {g.subject_name || 'Без предмета'}
                      {' · '}{g.students_count} учен.
                      {g.schedule_summary && ` · ${g.schedule_summary}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{fmtMoney(Number(g.monthly_fee))}/мес</div>
                    {!g.is_active && <span className="badge-slate text-[10px] mt-1">архив</span>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="px-5 py-4 border-b border-slate-100 font-semibold flex items-center gap-2">
            <ClipboardList size={18} className="text-violet-600" /> Открытые задачи
          </div>
          {data.tasks.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">Нет открытых задач.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.tasks.map(t => {
                const overdue = !!t.due_at && isBefore(parseISO(t.due_at), new Date());
                return (
                  <li key={t.id} className={clsx('px-5 py-3 text-sm flex justify-between', overdue && 'text-rose-700')}>
                    <div className="truncate flex items-center gap-2">
                      {t.kind === 'plan' ? <Target size={14} className="text-violet-500" /> : <ClipboardList size={14} className="text-slate-400" />}
                      {t.title}
                    </div>
                    {t.due_at && <span className="text-xs whitespace-nowrap ml-2">{fmtDateTime(t.due_at)}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {isTeacher && (
          <div className="card">
            <div className="px-5 py-4 border-b border-slate-100 font-semibold flex items-center gap-2">
              <Wallet size={18} className="text-emerald-600" /> Выплаты преподавателю
            </div>
            {data.payouts.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">Выплат пока не было.</div>
            ) : (
              <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {data.payouts.map(p => (
                  <li key={p.id} className="px-5 py-3 text-sm flex justify-between">
                    <div>
                      <div className="font-medium text-slate-900">{fmtMoney(Number(p.amount), p.currency)}</div>
                      <div className="text-xs text-slate-500">{p.description || '—'}</div>
                    </div>
                    <span className="text-xs text-slate-500 whitespace-nowrap">{fmtDate(p.paid_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
        {icon} {label}
      </div>
      <div className="text-sm text-slate-900 mt-1 font-medium">{value}</div>
    </div>
  );
}
