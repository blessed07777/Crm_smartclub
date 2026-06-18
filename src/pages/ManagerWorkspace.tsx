import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import type { Lead, LeadStatus } from '@/types/database';
import { useAuth } from '@/stores/auth';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Modal from '@/components/ui/Modal';
import { Target, TrendingUp, Trophy, AlertCircle, Phone, Plus, Sparkles, ArrowRight } from 'lucide-react';
import { fmtMoney, fmtDate } from '@/lib/format';
import toast from 'react-hot-toast';

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  new:         { label: 'Новый',      tone: 'badge-blue' },
  contacted:   { label: 'Контакт',    tone: 'badge-violet' },
  trial:       { label: 'Пробный',    tone: 'badge-amber' },
  negotiation: { label: 'Переговоры', tone: 'badge-amber' },
  won:         { label: 'Купил',      tone: 'badge-green' },
  lost:        { label: 'Отказ',      tone: 'badge-red' },
};

const STAGES: LeadStatus[] = ['new', 'contacted', 'trial', 'negotiation'];

export default function ManagerWorkspace() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ['manager-stats'], queryFn: () => api.manager.stats() });

  if (!user) return null;

  const byStatus = new Map<string, { count: number; value: number }>();
  (data?.byStatus || []).forEach(r => byStatus.set(r.status, { count: r.count, value: r.value }));

  const openLeads = STAGES.reduce((s, st) => s + (byStatus.get(st)?.count || 0), 0);
  const pipelineValue = STAGES.reduce((s, st) => s + (byStatus.get(st)?.value || 0), 0);
  const wonMonth = data?.monthSummary?.won_month ?? 0;
  const createdMonth = data?.monthSummary?.created_month ?? 0;
  const conversion = createdMonth > 0 ? Math.round((wonMonth / createdMonth) * 100) : null;
  const revenueMonth = data?.monthSummary?.revenue_month ?? 0;

  return (
    <div>
      <PageHeader
        title={`Кабинет менеджера — ${user.full_name?.split(' ')[0] || ''}`}
        subtitle="Ваши лиды, задачи и продажи"
        actions={
          <>
            <button className="btn-primary" onClick={() => setAdding(true)}><Plus size={16} /> Новый лид</button>
            <Link to="/leads" className="btn-secondary">Все лиды <ArrowRight size={14} /></Link>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Открытых лидов" value={openLeads} hint={`всего: ${data?.total?.total ?? 0}`} icon={<Target size={20} />} tone="brand" />
        <StatCard label="Стоимость пайплайна" value={fmtMoney(pipelineValue)} hint="по открытым стадиям" icon={<TrendingUp size={20} />} tone="emerald" />
        <StatCard label="Закрыто в этом месяце" value={wonMonth} hint={`из ${createdMonth} созданных`} icon={<Trophy size={20} />} tone="amber" />
        <StatCard label="Конверсия / выручка" value={conversion != null ? `${conversion}%` : '—'} hint={fmtMoney(revenueMonth)} icon={<Sparkles size={20} />} tone="rose" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Pipeline by stage */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Target size={18} /> Мой пайплайн</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {STAGES.map(st => {
              const v = byStatus.get(st) || { count: 0, value: 0 };
              return (
                <div key={st} className="bg-slate-50 rounded-lg p-3">
                  <div className={`${STATUS_LABEL[st].tone} inline-block`}>{STATUS_LABEL[st].label}</div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">{v.count}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{fmtMoney(v.value)}</div>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="bg-emerald-50 rounded-lg p-3">
              <div className="badge-green inline-block">{STATUS_LABEL.won.label}</div>
              <div className="mt-2 text-2xl font-bold text-emerald-700">{byStatus.get('won')?.count || 0}</div>
              <div className="text-xs text-slate-500 mt-0.5">{fmtMoney(byStatus.get('won')?.value || 0)}</div>
            </div>
            <div className="bg-rose-50 rounded-lg p-3">
              <div className="badge-red inline-block">{STATUS_LABEL.lost.label}</div>
              <div className="mt-2 text-2xl font-bold text-rose-700">{byStatus.get('lost')?.count || 0}</div>
            </div>
          </div>
        </div>

        {/* Recent wins */}
        <div className="card p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Trophy size={18} className="text-amber-500" /> Последние продажи</h3>
          {(data?.recentWon || []).length === 0 ? (
            <div className="text-sm text-slate-500">Пока нет закрытых сделок 🌱</div>
          ) : (
            <ul className="space-y-3">
              {data!.recentWon.map(l => (
                <li key={l.id} className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-sm text-slate-900">{l.full_name}</div>
                    <div className="text-xs text-slate-500">{fmtDate(l.updated_at)}</div>
                  </div>
                  <div className="text-sm font-semibold text-emerald-700">{fmtMoney(Number(l.expected_revenue || 0))}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Stale leads */}
      <div className="card p-5 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <AlertCircle size={18} className="text-amber-500" /> Лиды без активности 3+ дней
          </h3>
          <Link to="/leads" className="text-sm text-brand-600 hover:underline">Открыть воронку →</Link>
        </div>
        {isLoading ? (
          <div className="text-slate-500">Загрузка…</div>
        ) : (data?.stale || []).length === 0 ? (
          <div className="text-sm text-emerald-700 bg-emerald-50 rounded-lg p-4">
            🎉 Отлично! Нет лидов, которые требуют срочного звонка.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="table-th">ФИО</th>
                  <th className="table-th">Телефон</th>
                  <th className="table-th">Статус</th>
                  <th className="table-th">Ожидаемая выручка</th>
                  <th className="table-th">Последнее обновление</th>
                  <th className="table-th"></th>
                </tr>
              </thead>
              <tbody>
                {data!.stale.map(l => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="table-td font-medium">{l.full_name}</td>
                    <td className="table-td"><a href={`tel:${l.phone}`} className="text-brand-600 hover:underline flex items-center gap-1"><Phone size={12} /> {l.phone}</a></td>
                    <td className="table-td"><span className={STATUS_LABEL[l.status]?.tone}>{STATUS_LABEL[l.status]?.label}</span></td>
                    <td className="table-td">{fmtMoney(Number(l.expected_revenue || 0))}</td>
                    <td className="table-td text-slate-500">{fmtDate(l.updated_at)}</td>
                    <td className="table-td text-right">
                      <a
                        href={`https://wa.me/${l.phone.replace(/\D/g,'')}?text=${encodeURIComponent('Здравствуйте! Это SmartClub, напоминаю про подготовку к ЕНТ.')}`}
                        target="_blank" rel="noreferrer"
                        className="btn-ghost p-1.5" title="Написать в WhatsApp"
                      >
                        💬
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {adding && <QuickAddLead onClose={() => setAdding(false)} onSaved={() => { setAdding(false); qc.invalidateQueries({ queryKey: ['manager-stats'] }); }} />}
    </div>
  );
}

function QuickAddLead({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<Lead>>({ full_name: '', phone: '', status: 'new', expected_revenue: 0 });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.full_name || !form.phone) { toast.error('ФИО и телефон обязательны'); return; }
    setSaving(true);
    try {
      await api.leads.create(form);
      toast.success('Лид создан');
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Новый лид" footer={
      <>
        <button className="btn-secondary" onClick={onClose}>Отмена</button>
        <button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Сохраняем…' : 'Создать'}</button>
      </>
    }>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className="label">ФИО *</label><input className="input" value={form.full_name||''} onChange={e=>setForm({...form, full_name: e.target.value})} /></div>
        <div><label className="label">Телефон *</label><input className="input" value={form.phone||''} onChange={e=>setForm({...form, phone: e.target.value})} /></div>
        <div><label className="label">Класс</label><input type="number" className="input" value={form.grade ?? ''} onChange={e=>setForm({...form, grade: e.target.value ? Number(e.target.value) : null})} /></div>
        <div><label className="label">Источник</label><input className="input" value={form.source||''} onChange={e=>setForm({...form, source: e.target.value})} placeholder="Instagram, рекомендация…" /></div>
        <div><label className="label">Ожидаемая выручка</label><input type="number" className="input" value={form.expected_revenue ?? 0} onChange={e=>setForm({...form, expected_revenue: Number(e.target.value)})} /></div>
        <div className="col-span-2"><label className="label">Заметка</label><textarea className="input" rows={2} value={form.note||''} onChange={e=>setForm({...form, note: e.target.value})} /></div>
      </div>
    </Modal>
  );
}
