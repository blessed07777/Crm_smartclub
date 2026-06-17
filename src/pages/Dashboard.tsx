import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import { Users, GraduationCap, Wallet, Target, TrendingUp, CalendarDays } from 'lucide-react';
import { fmtMoney, fmtDateTime } from '@/lib/format';
import { useAuth } from '@/stores/auth';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from 'recharts';

export default function DashboardPage() {
  const { profile } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [students, leads, groups, payments, lessons] = await Promise.all([
        supabase.from('students').select('id, status', { count: 'exact', head: false }),
        supabase.from('leads').select('id, status', { count: 'exact', head: false }),
        supabase.from('groups').select('id, is_active', { count: 'exact', head: false }),
        supabase.from('payments').select('amount, kind, paid_at').gte('paid_at', new Date(Date.now()-30*864e5).toISOString().slice(0,10)),
        supabase.from('lessons').select('id, starts_at, group_id, topic').gte('starts_at', new Date().toISOString()).order('starts_at').limit(5),
      ]);
      const activeStudents = (students.data || []).filter(s => s.status === 'active').length;
      const openLeads = (leads.data || []).filter(l => !['won','lost'].includes(l.status)).length;
      const activeGroups = (groups.data || []).filter(g => g.is_active).length;
      const income30 = (payments.data || []).filter(p => p.kind === 'income').reduce((s,p) => s + Number(p.amount), 0);
      const expenses30 = (payments.data || []).filter(p => ['expense','payout','refund'].includes(p.kind)).reduce((s,p) => s + Number(p.amount), 0);
      return {
        activeStudents,
        openLeads,
        activeGroups,
        income30,
        expenses30,
        netProfit: income30 - expenses30,
        upcoming: lessons.data || [],
        payments: payments.data || [],
      };
    },
  });

  const chartData = (() => {
    const map = new Map<string, { day: string; income: number; expense: number }>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
      map.set(d, { day: d.slice(5), income: 0, expense: 0 });
    }
    (stats?.payments || []).forEach((p: any) => {
      const d = p.paid_at.slice(0, 10);
      const e = map.get(d);
      if (!e) return;
      if (p.kind === 'income') e.income += Number(p.amount);
      else e.expense += Number(p.amount);
    });
    return Array.from(map.values());
  })();

  return (
    <div>
      <PageHeader
        title={`Привет, ${profile?.full_name?.split(' ')[0] || 'друг'} 👋`}
        subtitle="Обзор работы школы за последние 30 дней"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Активные ученики" value={stats?.activeStudents ?? '—'} icon={<Users size={20} />} tone="brand" />
        <StatCard label="Открытые лиды" value={stats?.openLeads ?? '—'} icon={<Target size={20} />} tone="amber" />
        <StatCard label="Активные группы" value={stats?.activeGroups ?? '—'} icon={<GraduationCap size={20} />} tone="emerald" />
        <StatCard label="Чистая прибыль (30 дн.)" value={fmtMoney(stats?.netProfit ?? 0)} icon={<Wallet size={20} />} tone="rose" />
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
            {(stats?.upcoming || []).length === 0 && (
              <li className="text-sm text-slate-500">Занятий не запланировано</li>
            )}
            {(stats?.upcoming || []).map((l: any) => (
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
    </div>
  );
}
