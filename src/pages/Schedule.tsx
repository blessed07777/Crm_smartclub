import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Lesson, Group } from '@/types/database';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { Plus, CalendarDays, Trash2, Edit3 } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtDateTime } from '@/lib/format';

const empty: Partial<Lesson> = {
  group_id: '', starts_at: '', ends_at: '', topic: '', homework: '', is_canceled: false,
};

function nowLocal(offsetHours = 0) {
  const d = new Date(Date.now() + offsetHours * 3600 * 1000);
  d.setMinutes(0, 0, 0);
  return d.toISOString().slice(0, 16);
}

export default function SchedulePage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Lesson> | null>(null);

  const lessonsQ = useQuery({ queryKey: ['lessons'], queryFn: () => api.lessons.list({ orderBy: 'starts_at', order: 'desc', limit: 200 }) });
  const groupsQ  = useQuery({ queryKey: ['groups-all'], queryFn: () => api.groups.list({ orderBy: 'name', order: 'asc' }) });

  const save = useMutation({
    mutationFn: (l: Partial<Lesson>) => {
      const payload: Partial<Lesson> = {
        ...l,
        starts_at: l.starts_at ? new Date(l.starts_at).toISOString() : undefined,
        ends_at: l.ends_at ? new Date(l.ends_at).toISOString() : undefined,
      };
      return l.id ? api.lessons.update(l.id, payload) : api.lessons.create(payload);
    },
    onSuccess: () => { toast.success('Сохранено'); setEditing(null); qc.invalidateQueries({ queryKey: ['lessons'] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.lessons.remove(id),
    onSuccess: () => { toast.success('Удалено'); qc.invalidateQueries({ queryKey: ['lessons'] }); },
  });

  const groupName = (id: string) => groupsQ.data?.find((g: Group) => g.id === id)?.name || '—';

  const grouped = (lessonsQ.data || []).reduce<Record<string, Lesson[]>>((acc, l) => {
    const d = l.starts_at.slice(0, 10);
    (acc[d] ||= []).push(l);
    return acc;
  }, {});
  const dayKeys = Object.keys(grouped).sort().reverse();

  return (
    <div>
      <PageHeader
        title="Расписание занятий"
        subtitle="Все уроки школы по дням"
        actions={<button className="btn-primary" onClick={() => setEditing({ ...empty, starts_at: nowLocal(2), ends_at: nowLocal(3.5) })}><Plus size={16} /> Новый урок</button>}
      />

      {lessonsQ.isLoading ? <div className="text-slate-500">Загрузка…</div>
       : dayKeys.length === 0 ? (
        <EmptyState
          icon={<CalendarDays size={24} />}
          title="Уроков пока нет"
          hint="Запланируйте первый урок группы."
          action={<button className="btn-primary" onClick={() => setEditing({ ...empty, starts_at: nowLocal(2), ends_at: nowLocal(3.5) })}><Plus size={16} /> Создать урок</button>}
        />
       ) : (
        <div className="space-y-4">
          {dayKeys.map(d => (
            <div key={d} className="card">
              <div className="px-5 py-3 border-b border-slate-100 font-semibold text-slate-900">
                {new Date(d).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
              <div className="divide-y divide-slate-100">
                {grouped[d].sort((a,b) => a.starts_at.localeCompare(b.starts_at)).map(l => (
                  <div key={l.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50">
                    <div>
                      <div className="font-medium text-slate-900">{groupName(l.group_id)}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{fmtDateTime(l.starts_at)} — {new Date(l.ends_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} · {l.topic || 'Без темы'}</div>
                    </div>
                    <div className="flex gap-1">
                      {l.is_canceled && <span className="badge-red">Отменён</span>}
                      <button onClick={() => setEditing({ ...l, starts_at: l.starts_at.slice(0,16), ends_at: l.ends_at.slice(0,16) })} className="btn-ghost p-1.5"><Edit3 size={15} /></button>
                      <button onClick={() => confirm('Удалить урок?') && del.mutate(l.id)} className="btn-ghost p-1.5 text-rose-600"><Trash2 size={15} /></button>
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
          title={editing.id ? 'Редактировать урок' : 'Новый урок'}
          footer={<>
            <button className="btn-secondary" onClick={() => setEditing(null)}>Отмена</button>
            <button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate(editing)}>Сохранить</button>
          </>}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Группа *</label>
              <select className="input" value={editing.group_id||''} onChange={e=>setEditing({...editing, group_id: e.target.value})} required>
                <option value="">—</option>
                {(groupsQ.data || []).map((g: Group) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div><label className="label">Начало *</label><input type="datetime-local" className="input" value={editing.starts_at||''} onChange={e=>setEditing({...editing, starts_at: e.target.value})} required /></div>
            <div><label className="label">Окончание *</label><input type="datetime-local" className="input" value={editing.ends_at||''} onChange={e=>setEditing({...editing, ends_at: e.target.value})} required /></div>
            <div className="col-span-2"><label className="label">Тема</label><input className="input" value={editing.topic||''} onChange={e=>setEditing({...editing, topic: e.target.value})} /></div>
            <div className="col-span-2"><label className="label">Домашнее задание</label><textarea className="input" rows={2} value={editing.homework||''} onChange={e=>setEditing({...editing, homework: e.target.value})} /></div>
            <div className="col-span-2"><label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={!!editing.is_canceled} onChange={e=>setEditing({...editing, is_canceled: e.target.checked})} /> Урок отменён</label></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
