import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Lead, LeadStatus } from '@/types/database';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { Plus, Target, Phone, User, Trash2, Edit3 } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtMoney } from '@/lib/format';

const STATUSES: { value: LeadStatus; label: string }[] = [
  { value: 'new',         label: 'Новый' },
  { value: 'contacted',   label: 'Контакт' },
  { value: 'trial',       label: 'Пробный' },
  { value: 'negotiation', label: 'Переговоры' },
  { value: 'won',         label: 'Купил' },
  { value: 'lost',        label: 'Отказ' },
];

const empty: Partial<Lead> = {
  full_name: '', phone: '', parent_name: '', parent_phone: '',
  grade: undefined, status: 'new', source: '', note: '', expected_revenue: 0,
};

export default function LeadsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Lead> | null>(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: () => api.leads.list({ orderBy: 'created_at', order: 'desc' }),
  });

  const save = useMutation({
    mutationFn: async (l: Partial<Lead>) =>
      l.id ? api.leads.update(l.id, l) : api.leads.create(l),
    onSuccess: () => { toast.success('Сохранено'); setEditing(null); qc.invalidateQueries({ queryKey: ['leads'] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.leads.remove(id),
    onSuccess: () => { toast.success('Удалено'); qc.invalidateQueries({ queryKey: ['leads'] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const byStatus = STATUSES.map(s => ({
    ...s,
    items: leads.filter(l => l.status === s.value),
  }));

  return (
    <div>
      <PageHeader
        title="Лиды и воронка продаж"
        subtitle="Канбан-доска заявок от учеников и родителей"
        actions={<button className="btn-primary" onClick={() => setEditing({ ...empty })}><Plus size={16} /> Новый лид</button>}
      />

      {isLoading ? (
        <div className="text-slate-500">Загрузка…</div>
      ) : leads.length === 0 ? (
        <EmptyState
          icon={<Target size={24} />}
          title="Лидов пока нет"
          hint="Создайте первую заявку — система проведёт её по всей воронке от первого звонка до зачисления."
          action={<button className="btn-primary" onClick={() => setEditing({ ...empty })}><Plus size={16} /> Добавить лид</button>}
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 overflow-x-auto pb-4">
          {byStatus.map(col => (
            <div key={col.value} className="bg-slate-100/60 rounded-xl p-3 min-w-[220px]">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{col.label}</div>
                <span className="text-xs bg-white px-2 py-0.5 rounded-full text-slate-600">{col.items.length}</span>
              </div>
              <div className="space-y-2">
                {col.items.map(l => (
                  <div key={l.id} className="bg-white rounded-lg p-3 shadow-sm border border-slate-100 group">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-sm text-slate-900 flex items-center gap-1">
                        <User size={12} className="text-slate-400" /> {l.full_name}
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition">
                        <button onClick={() => setEditing(l)} className="text-slate-400 hover:text-brand-600"><Edit3 size={13} /></button>
                        <button onClick={() => confirm('Удалить?') && del.mutate(l.id)} className="text-slate-400 hover:text-rose-600"><Trash2 size={13} /></button>
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-1"><Phone size={11} />{l.phone}</div>
                    {l.grade && <div className="text-xs text-slate-500 mt-0.5">{l.grade} класс</div>}
                    {!!l.expected_revenue && <div className="text-xs text-emerald-700 font-medium mt-1">{fmtMoney(Number(l.expected_revenue))}</div>}
                    <div className="mt-2 flex gap-1">
                      {STATUSES.filter(s => s.value !== l.status).slice(0, 2).map(s => (
                        <button
                          key={s.value}
                          onClick={() => save.mutate({ id: l.id, status: s.value })}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600"
                        >
                          → {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Modal
          open onClose={() => setEditing(null)}
          title={editing.id ? 'Редактировать лид' : 'Новый лид'}
          footer={<>
            <button className="btn-secondary" onClick={() => setEditing(null)}>Отмена</button>
            <button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate(editing)}>{save.isPending ? 'Сохраняем…' : 'Сохранить'}</button>
          </>}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">ФИО ученика *</label><input className="input" value={editing.full_name||''} onChange={e=>setEditing({...editing, full_name: e.target.value})} required /></div>
            <div><label className="label">Телефон *</label><input className="input" value={editing.phone||''} onChange={e=>setEditing({...editing, phone: e.target.value})} required /></div>
            <div><label className="label">Класс</label><input type="number" min={1} max={12} className="input" value={editing.grade ?? ''} onChange={e=>setEditing({...editing, grade: e.target.value ? Number(e.target.value) : null})} /></div>
            <div><label className="label">Родитель</label><input className="input" value={editing.parent_name||''} onChange={e=>setEditing({...editing, parent_name: e.target.value})} /></div>
            <div><label className="label">Телефон родителя</label><input className="input" value={editing.parent_phone||''} onChange={e=>setEditing({...editing, parent_phone: e.target.value})} /></div>
            <div><label className="label">Источник</label><input className="input" value={editing.source||''} onChange={e=>setEditing({...editing, source: e.target.value})} placeholder="Instagram, рекомендация…" /></div>
            <div>
              <label className="label">Статус</label>
              <select className="input" value={editing.status||'new'} onChange={e=>setEditing({...editing, status: e.target.value as LeadStatus})}>
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="col-span-2"><label className="label">Ожидаемая выручка, ₸</label><input type="number" className="input" value={editing.expected_revenue ?? 0} onChange={e=>setEditing({...editing, expected_revenue: Number(e.target.value)})} /></div>
            <div className="col-span-2"><label className="label">Заметка</label><textarea className="input" rows={3} value={editing.note||''} onChange={e=>setEditing({...editing, note: e.target.value})} /></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
