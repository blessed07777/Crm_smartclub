import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { exportCSV } from '@/lib/csv';
import type { Payment, PaymentKind, Student, Group, Profile } from '@/types/database';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import StatCard from '@/components/ui/StatCard';
import { Plus, Wallet, TrendingUp, TrendingDown, Trash2, ArrowDownUp, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtMoney, fmtDate } from '@/lib/format';

const KIND_LABEL: Record<PaymentKind, { label: string; tone: string }> = {
  income:  { label: 'Доход',    tone: 'badge-green' },
  expense: { label: 'Расход',   tone: 'badge-red' },
  payout:  { label: 'Зарплата', tone: 'badge-amber' },
  refund:  { label: 'Возврат',  tone: 'badge-slate' },
};

const empty: Partial<Payment> = {
  kind: 'income', amount: 0, currency: 'KZT', category: '', method: 'Каспи',
  description: '', paid_at: new Date().toISOString().slice(0,10),
};

export default function FinancePage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Payment> | null>(null);
  const [filterKind, setFilterKind] = useState<PaymentKind | 'all'>('all');

  const paymentsQ = useQuery({ queryKey: ['payments'], queryFn: () => api.payments.list({ orderBy: 'paid_at', order: 'desc', limit: 500 }) });
  const studentsQ = useQuery({ queryKey: ['students-fin'], queryFn: () => api.students.list({ limit: 1000 }) });
  const groupsQ   = useQuery({ queryKey: ['groups-fin'],   queryFn: () => api.groups.list({ limit: 1000 }) });
  const usersQ    = useQuery({ queryKey: ['users-fin'],    queryFn: () => api.users.list() });

  const save = useMutation({
    mutationFn: (p: Partial<Payment>) => p.id ? api.payments.update(p.id, p) : api.payments.create(p),
    onSuccess: () => { toast.success('Сохранено'); setEditing(null); qc.invalidateQueries({ queryKey: ['payments'] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.payments.remove(id),
    onSuccess: () => { toast.success('Удалено'); qc.invalidateQueries({ queryKey: ['payments'] }); },
  });

  const list = (paymentsQ.data || []).filter(p => filterKind === 'all' || p.kind === filterKind);
  const totals = (paymentsQ.data || []).reduce((acc, p) => {
    if (p.kind === 'income') acc.income += Number(p.amount);
    else if (p.kind === 'refund') acc.income -= Number(p.amount);
    else acc.expense += Number(p.amount);
    return acc;
  }, { income: 0, expense: 0 });
  const net = totals.income - totals.expense;

  return (
    <div>
      <PageHeader
        title="Финансы"
        subtitle="Доходы, расходы, зарплаты"
        actions={<>
          <button className="btn-secondary" onClick={() => {
            const rows = list.map(p => ({
              ...p,
              who: p.student_id ? studentsQ.data?.find((s: Student) => s.id === p.student_id)?.full_name
                 : p.teacher_id ? usersQ.data?.find((u: Profile) => u.id === p.teacher_id)?.full_name
                 : p.group_id   ? groupsQ.data?.find((g: Group) => g.id === p.group_id)?.name
                 : (p.category || ''),
            }));
            exportCSV('payments', rows, [
              { key: 'paid_at', label: 'Дата', format: v => fmtDate(v) },
              { key: 'kind', label: 'Тип', format: v => KIND_LABEL[v as PaymentKind]?.label || v },
              { key: 'amount', label: 'Сумма' },
              { key: 'currency', label: 'Валюта' },
              { key: 'who', label: 'Контрагент' },
              { key: 'method', label: 'Способ' },
              { key: 'description', label: 'Описание' },
            ]);
          }} disabled={!list.length}><Download size={14} /> Экспорт CSV</button>
          <button className="btn-primary" onClick={() => setEditing({ ...empty })}><Plus size={16} /> Транзакция</button>
        </>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Доход (всё время)" value={fmtMoney(totals.income)} icon={<TrendingUp size={20} />} tone="emerald" />
        <StatCard label="Расход" value={fmtMoney(totals.expense)} icon={<TrendingDown size={20} />} tone="rose" />
        <StatCard label="Чистая прибыль" value={fmtMoney(net)} icon={<Wallet size={20} />} tone="brand" />
        <StatCard label="Транзакций" value={paymentsQ.data?.length ?? '—'} icon={<ArrowDownUp size={20} />} tone="slate" />
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto">
        {(['all','income','expense','payout','refund'] as const).map(k => (
          <button
            key={k}
            onClick={() => setFilterKind(k)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filterKind === k ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}
          >
            {k === 'all' ? 'Все' : KIND_LABEL[k].label}
          </button>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="table-th">Дата</th>
              <th className="table-th">Тип</th>
              <th className="table-th">Сумма</th>
              <th className="table-th">Контрагент</th>
              <th className="table-th">Описание</th>
              <th className="table-th"></th>
            </tr>
          </thead>
          <tbody>
            {list.map(p => {
              const who = p.student_id ? studentsQ.data?.find((s: Student) => s.id === p.student_id)?.full_name
                        : p.teacher_id ? usersQ.data?.find((t: Profile) => t.id === p.teacher_id)?.full_name
                        : p.group_id   ? groupsQ.data?.find((g: Group) => g.id === p.group_id)?.name
                        : (p.category || '—');
              return (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="table-td">{fmtDate(p.paid_at)}</td>
                  <td className="table-td"><span className={KIND_LABEL[p.kind].tone}>{KIND_LABEL[p.kind].label}</span></td>
                  <td className="table-td font-semibold">{fmtMoney(Number(p.amount), p.currency)}</td>
                  <td className="table-td">{who}</td>
                  <td className="table-td">{p.description || '—'}</td>
                  <td className="table-td text-right">
                    <button onClick={() => confirm('Удалить транзакцию?') && del.mutate(p.id)} className="btn-ghost p-1.5 text-rose-600"><Trash2 size={15} /></button>
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && <tr><td colSpan={6} className="table-td text-center text-slate-500 py-10">Нет транзакций</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing.id ? 'Редактировать транзакцию' : 'Новая транзакция'}
          footer={<>
            <button className="btn-secondary" onClick={() => setEditing(null)}>Отмена</button>
            <button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate(editing)}>Сохранить</button>
          </>}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Тип *</label>
              <select className="input" value={editing.kind||'income'} onChange={e=>setEditing({...editing, kind: e.target.value as PaymentKind})}>
                {Object.entries(KIND_LABEL).map(([v,{label}]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
            <div><label className="label">Сумма, ₸ *</label><input type="number" className="input" value={editing.amount ?? 0} onChange={e=>setEditing({...editing, amount: Number(e.target.value)})} required /></div>
            <div><label className="label">Дата *</label><input type="date" className="input" value={editing.paid_at||''} onChange={e=>setEditing({...editing, paid_at: e.target.value})} required /></div>
            <div><label className="label">Способ оплаты</label><input className="input" value={editing.method||''} onChange={e=>setEditing({...editing, method: e.target.value})} placeholder="Каспи, Halyk, наличные" /></div>
            {editing.kind === 'income' || editing.kind === 'refund' ? (
              <div className="col-span-2">
                <label className="label">Ученик</label>
                <select className="input" value={editing.student_id||''} onChange={e=>setEditing({...editing, student_id: e.target.value || null})}>
                  <option value="">—</option>
                  {(studentsQ.data || []).map((s: Student) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              </div>
            ) : editing.kind === 'payout' ? (
              <div className="col-span-2">
                <label className="label">Преподаватель</label>
                <select className="input" value={editing.teacher_id||''} onChange={e=>setEditing({...editing, teacher_id: e.target.value || null})}>
                  <option value="">—</option>
                  {(usersQ.data || []).filter((t: Profile) => t.role === 'teacher').map((t: Profile) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </div>
            ) : (
              <div className="col-span-2"><label className="label">Категория</label><input className="input" value={editing.category||''} onChange={e=>setEditing({...editing, category: e.target.value})} placeholder="Аренда, реклама, материалы…" /></div>
            )}
            <div className="col-span-2"><label className="label">Описание</label><textarea className="input" rows={2} value={editing.description||''} onChange={e=>setEditing({...editing, description: e.target.value})} /></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
