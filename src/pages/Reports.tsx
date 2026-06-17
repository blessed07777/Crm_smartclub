import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import PageHeader from '@/components/ui/PageHeader';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { fmtMoney } from '@/lib/format';

const COLORS = ['#4f46e5','#10b981','#f59e0b','#ef4444','#06b6d4','#8b5cf6','#22c55e','#0ea5e9','#f43f5e','#14b8a6'];

export default function ReportsPage() {
  const monthlyQ = useQuery({
    queryKey: ['report-monthly'],
    queryFn: async () => {
      const { data, error } = await supabase.from('payments').select('amount, kind, paid_at').gte('paid_at', new Date(Date.now()-365*864e5).toISOString().slice(0,10));
      if (error) throw error;
      const map = new Map<string, { month: string; income: number; expense: number }>();
      for (const p of data || []) {
        const m = p.paid_at.slice(0,7);
        const row = map.get(m) || { month: m, income: 0, expense: 0 };
        if (p.kind === 'income') row.income += Number(p.amount);
        else row.expense += Number(p.amount);
        map.set(m, row);
      }
      return Array.from(map.values()).sort((a,b) => a.month.localeCompare(b.month));
    },
  });

  const leadsQ = useQuery({
    queryKey: ['report-leads'],
    queryFn: async () => {
      const { data } = await supabase.from('leads').select('status');
      const counts: Record<string, number> = {};
      (data || []).forEach(l => counts[l.status] = (counts[l.status] || 0) + 1);
      return Object.entries(counts).map(([name, value]) => ({ name, value }));
    },
  });

  const groupRevQ = useQuery({
    queryKey: ['report-group-revenue'],
    queryFn: async () => {
      const { data: groups } = await supabase.from('groups').select('id, name, monthly_fee');
      const { data: gs } = await supabase.from('group_students').select('group_id');
      const counts: Record<string, number> = {};
      (gs || []).forEach(r => counts[r.group_id] = (counts[r.group_id] || 0) + 1);
      return (groups || []).map(g => ({
        name: g.name,
        revenue: counts[g.id] ? counts[g.id] * Number(g.monthly_fee) : 0,
        students: counts[g.id] || 0,
      })).sort((a,b) => b.revenue - a.revenue).slice(0, 10);
    },
  });

  return (
    <div>
      <PageHeader title="Отчёты и аналитика" subtitle="Финансы и продажи в разрезе" />

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <div className="card p-5">
          <h3 className="font-semibold mb-4">Доходы и расходы по месяцам</h3>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={monthlyQ.data || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => fmtMoney(v)} />
                <Legend />
                <Bar dataKey="income" fill="#10b981" name="Доход" />
                <Bar dataKey="expense" fill="#f43f5e" name="Расход" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold mb-4">Воронка лидов</h3>
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={leadsQ.data || []} dataKey="value" nameKey="name" outerRadius={100} label>
                  {(leadsQ.data || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold mb-4">Топ-10 групп по выручке (потенциал/мес)</h3>
        <div className="h-80">
          <ResponsiveContainer>
            <BarChart data={groupRevQ.data || []} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
              <Tooltip formatter={(v: number) => fmtMoney(v)} />
              <Bar dataKey="revenue" fill="#4f46e5" name="Выручка/мес" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
