import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { fmtMoney } from '@/lib/format';

const COLORS = ['#4f46e5','#10b981','#f59e0b','#ef4444','#06b6d4','#8b5cf6','#22c55e','#0ea5e9','#f43f5e','#14b8a6'];
const STATUS_LABEL: Record<string, string> = {
  new: 'Новые', contacted: 'Контакт', trial: 'Пробный', negotiation: 'Переговоры', won: 'Купили', lost: 'Отказы',
};

export default function ReportsPage() {
  const monthlyQ = useQuery({ queryKey: ['report-monthly'], queryFn: () => api.reports.monthly() });
  const leadsQ   = useQuery({ queryKey: ['report-leads'],   queryFn: () => api.reports.leadsFunnel() });
  const groupRevQ = useQuery({ queryKey: ['report-group-revenue'], queryFn: () => api.reports.groupRevenue() });

  const leadsData = (leadsQ.data || []).map(d => ({ name: STATUS_LABEL[d.name] || d.name, value: d.value }));

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
                <Pie data={leadsData} dataKey="value" nameKey="name" outerRadius={100} label>
                  {leadsData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
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
