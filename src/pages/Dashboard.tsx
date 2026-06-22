import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import { Users, GraduationCap, Wallet, Target, TrendingUp, CalendarDays, ClipboardList, Clock, AlertTriangle } from 'lucide-react';
import { fmtMoney, fmtDateTime } from '@/lib/format';
import { useAuth } from '@/stores/auth';
import { ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from 'recharts';
import { isBefore, isToday, parseISO, format } from 'date-fns';
import { ru } from 'date-fns/locale';
import clsx from 'clsx';

import TeacherWorkspace from '@/pages/TeacherWorkspace';
import ManagerWorkspace from '@/pages/ManagerWorkspace';

export default function DashboardPage() {
  const { user } = useAuth();

  // Role-aware root: teachers and managers get their own workspace as Home
  if (user?.role === 'teacher') return <TeacherWorkspace />;
  if (user?.role === 'manager') return <ManagerWorkspace />;

  return <AdminDashboard />;
}

function AdminDashboard() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.dashboard.stats(),
  });

  const chartData = (() => {
    const map = new Map<string, { day: string; income: number; expense: number }>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
      map.set(d, { day: d.slice(5), income: 0, expense: 0 });
    }
    (data?.daily || []).forEach(r => {
      const d = String(r.day).slice(0, 10);
      const e = map.get(d);
      if (!e) return;
      if (r.kind === 'income') e.income += Number(r.total);
      else e.expense += Number(r.total);
    });
    return Array.from(map.values());
  })();

  return (
    <div>
      <PageHeader
        title={`Привет, ${user?.full_name?.split(' ')[0] || 'друг'} 👋`}
        subtitle="Обзор работы школы за последние 30 дней"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Активные ученики" value={data?.students.active_students ?? '—'} icon={<Users size={20} />} tone="brand" />
        <StatCard label="Открытые лиды"     value={data?.leads.open_leads ?? '—'}        icon={<Target size={20} />} tone="amber" />
        <StatCard label="Активные группы"   value={data?.groups.active_groups ?? '—'}    icon={<GraduationCap size={20} />} tone="emerald" />
        <StatCard label="Прибыль (30 дн.)"  value={fmtMoney(data?.finance30.net ?? 0)}   icon={<Wallet size={20} />} tone="rose" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Доходы и расходы (30 дней)</h3>
            <TrendingUp size={18} className="text-emerald-600" />
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => fmtMoney(v)} />
                <Bar dataKey="income" fill="#10b981" name="Доход" radius={[4,4,0,0]} />
                <Bar dataKey="expense" fill="#f43f5e" name="Расход" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Ближайшие занятия</h3>
            <CalendarDays size={18} className="text-brand-600" />
          </div>
          <ul className="space-y-3">
            {(data?.upcoming || []).length === 0 && (
              <li className="text-sm text-slate-500">Занятий не запланировано</li>
            )}
            {(data?.upcoming || []).map(l => (
              <li key={l.id} className="flex items-start gap-3 text-sm">
                <div className="w-2 h-2 mt-2 rounded-full bg-brand-500" />
                <div>
                  <div className="font-medium text-slate-900">{l.topic || 'Занятие'}</div>
                  <div className="text-xs text-slate-500">{fmtDateTime(l.starts_at)}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card p-5 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <ClipboardList size={18} className="text-brand-600" /> Мои задачи
            {!!data?.overdueTasks && (
              <span className="badge-red ml-1">
                <AlertTriangle size={10} className="inline mr-0.5" /> {data.overdueTasks} просрочено
              </span>
            )}
          </h3>
          <Link to="/tasks" className="text-sm text-brand-600 hover:underline">Все задачи →</Link>
        </div>
        {(data?.myTasks || []).length === 0 ? (
          <div className="text-sm text-emerald-700 bg-emerald-50 rounded-lg p-4 text-center">
            🎉 У вас нет открытых задач. Создайте новую в разделе «Задачи и планы».
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {(data?.myTasks || []).map(t => {
              const overdue = !!t.due_at && isBefore(parseISO(t.due_at), new Date());
              const today  = !!t.due_at && isToday(parseISO(t.due_at));
              return (
                <li key={t.id} className={clsx('py-3 flex items-center justify-between gap-3', overdue && 'text-rose-700')}>
                  <div className="flex items-center gap-3 min-w-0">
                    {t.kind === 'plan'
                      ? <Target size={16} className="text-violet-500 flex-shrink-0" />
                      : <ClipboardList size={16} className="text-slate-400 flex-shrink-0" />}
                    <div className="min-w-0">
                      <div className={clsx('font-medium truncate', overdue ? 'text-rose-700' : 'text-slate-900')}>{t.title}</div>
                      {t.due_at && (
                        <div className={clsx('text-xs flex items-center gap-1 mt-0.5', overdue ? 'text-rose-600' : today ? 'text-amber-600' : 'text-slate-500')}>
                          <Clock size={11} />
                          {format(parseISO(t.due_at), 'd MMM, HH:mm', { locale: ru })}
                          {overdue && ' · просрочено'}
                          {today && !overdue && ' · сегодня'}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className={clsx(
                    'badge',
                    t.priority === 'urgent' ? 'badge-red' :
                    t.priority === 'high'   ? 'badge-amber' :
                    t.priority === 'low'    ? 'badge-slate' : 'badge-blue',
                  )}>
                    {t.priority === 'urgent' ? 'Срочный' :
                     t.priority === 'high'   ? 'Высокий' :
                     t.priority === 'low'    ? 'Низкий'  : 'Обычный'}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
