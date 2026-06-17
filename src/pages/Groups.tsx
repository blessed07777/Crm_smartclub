import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Group, Subject, Profile, Student } from '@/types/database';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { Plus, GraduationCap, Trash2, Edit3, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtMoney } from '@/lib/format';

const empty: Partial<Group> = {
  name: '', subject_id: null, teacher_id: null, monthly_fee: 30000, capacity: 12,
  schedule_summary: '', is_active: true,
};

export default function GroupsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Group> | null>(null);
  const [rosterFor, setRosterFor] = useState<Group | null>(null);

  const groupsQ = useQuery({ queryKey: ['groups'], queryFn: async () => {
    const { data, error } = await supabase.from('groups').select('*').order('created_at', { ascending: false });
    if (error) throw error; return data as Group[];
  }});
  const subjectsQ = useQuery({ queryKey: ['subjects'], queryFn: async () => {
    const { data, error } = await supabase.from('subjects').select('*').order('name');
    if (error) throw error; return data as Subject[];
  }});
  const teachersQ = useQuery({ queryKey: ['profiles-teachers'], queryFn: async () => {
    const { data, error } = await supabase.from('profiles').select('*').in('role', ['teacher']);
    if (error) throw error; return data as Profile[];
  }});

  const save = useMutation({
    mutationFn: async (g: Partial<Group>) => {
      const payload: any = { ...g };
      if (payload.id) { const { error } = await supabase.from('groups').update(payload).eq('id', payload.id); if (error) throw error; }
      else { const { error } = await supabase.from('groups').insert(payload); if (error) throw error; }
    },
    onSuccess: () => { toast.success('Сохранено'); setEditing(null); qc.invalidateQueries({ queryKey: ['groups'] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('groups').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { toast.success('Удалено'); qc.invalidateQueries({ queryKey: ['groups'] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Группы и потоки"
        subtitle="Учебные группы по предметам ЕНТ"
        actions={<button className="btn-primary" onClick={() => setEditing({ ...empty })}><Plus size={16} /> Новая группа</button>}
      />

      {groupsQ.isLoading ? (
        <div className="text-slate-500">Загрузка…</div>
      ) : (groupsQ.data || []).length === 0 ? (
        <EmptyState
          icon={<GraduationCap size={24} />}
          title="Групп пока нет"
          hint="Создайте учебную группу — назначьте преподавателя, расписание и стоимость."
          action={<button className="btn-primary" onClick={() => setEditing({ ...empty })}><Plus size={16} /> Создать группу</button>}
        />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(groupsQ.data || []).map(g => {
            const subj = subjectsQ.data?.find(s => s.id === g.subject_id);
            const teacher = teachersQ.data?.find(t => t.id === g.teacher_id);
            return (
              <div key={g.id} className="card p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold text-slate-900">{g.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      <span style={{ color: subj?.color || '#6366f1' }}>●</span> {subj?.name || 'Без предмета'}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setEditing(g)} className="btn-ghost p-1.5"><Edit3 size={15} /></button>
                    <button onClick={() => confirm('Удалить группу?') && del.mutate(g.id)} className="btn-ghost p-1.5 text-rose-600"><Trash2 size={15} /></button>
                  </div>
                </div>
                <div className="text-sm text-slate-600 space-y-1">
                  <div>Преподаватель: <b className="text-slate-900">{teacher?.full_name || '—'}</b></div>
                  <div>Стоимость: <b className="text-slate-900">{fmtMoney(g.monthly_fee)}/мес</b></div>
                  <div>Расписание: {g.schedule_summary || '—'}</div>
                </div>
                <button className="btn-secondary w-full mt-4" onClick={() => setRosterFor(g)}>
                  <Users size={15} /> Состав группы
                </button>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <Modal
          open onClose={() => setEditing(null)}
          title={editing.id ? 'Редактировать группу' : 'Новая группа'}
          footer={
            <>
              <button className="btn-secondary" onClick={() => setEditing(null)}>Отмена</button>
              <button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate(editing)}>Сохранить</button>
            </>
          }
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">Название *</label><input className="input" value={editing.name||''} onChange={e=>setEditing({...editing, name: e.target.value})} required /></div>
            <div>
              <label className="label">Предмет</label>
              <select className="input" value={editing.subject_id||''} onChange={e=>setEditing({...editing, subject_id: e.target.value || null})}>
                <option value="">—</option>
                {(subjectsQ.data || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Преподаватель</label>
              <select className="input" value={editing.teacher_id||''} onChange={e=>setEditing({...editing, teacher_id: e.target.value || null})}>
                <option value="">—</option>
                {(teachersQ.data || []).map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
            </div>
            <div><label className="label">Стоимость, ₸/мес</label><input type="number" className="input" value={editing.monthly_fee ?? 0} onChange={e=>setEditing({...editing, monthly_fee: Number(e.target.value)})} /></div>
            <div><label className="label">Вместимость</label><input type="number" className="input" value={editing.capacity ?? 12} onChange={e=>setEditing({...editing, capacity: Number(e.target.value)})} /></div>
            <div className="col-span-2"><label className="label">Расписание (описание)</label><input className="input" value={editing.schedule_summary||''} onChange={e=>setEditing({...editing, schedule_summary: e.target.value})} placeholder="Пн, Ср, Пт 17:00–18:30" /></div>
            <div><label className="label">Начало</label><input type="date" className="input" value={editing.starts_on || ''} onChange={e=>setEditing({...editing, starts_on: e.target.value || null})} /></div>
            <div><label className="label">Завершение</label><input type="date" className="input" value={editing.ends_on || ''} onChange={e=>setEditing({...editing, ends_on: e.target.value || null})} /></div>
            <div className="col-span-2"><label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.is_active ?? true} onChange={e=>setEditing({...editing, is_active: e.target.checked})} /> Группа активна</label></div>
          </div>
        </Modal>
      )}

      {rosterFor && <RosterModal group={rosterFor} onClose={() => setRosterFor(null)} />}
    </div>
  );
}

function RosterModal({ group, onClose }: { group: Group; onClose: () => void }) {
  const qc = useQueryClient();
  const rosterQ = useQuery({
    queryKey: ['roster', group.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_students')
        .select('student_id, students!inner(*)')
        .eq('group_id', group.id);
      if (error) throw error;
      return (data || []).map((r: any) => r.students) as Student[];
    },
  });
  const studentsQ = useQuery({ queryKey: ['students-all'], queryFn: async () => {
    const { data, error } = await supabase.from('students').select('*').order('full_name');
    if (error) throw error; return data as Student[];
  }});

  const add = useMutation({
    mutationFn: async (sid: string) => {
      const { error } = await supabase.from('group_students').insert({ group_id: group.id, student_id: sid });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roster', group.id] }),
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (sid: string) => {
      const { error } = await supabase.from('group_students').delete().match({ group_id: group.id, student_id: sid });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roster', group.id] }),
  });

  const inGroup = new Set((rosterQ.data || []).map(s => s.id));
  const candidates = (studentsQ.data || []).filter(s => !inGroup.has(s.id));

  return (
    <Modal open onClose={onClose} title={`Состав группы: ${group.name}`} size="lg">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <div className="text-xs font-semibold text-slate-600 uppercase mb-2">В группе ({(rosterQ.data || []).length})</div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {(rosterQ.data || []).map(s => (
              <div key={s.id} className="flex items-center justify-between bg-slate-50 rounded-lg p-2 text-sm">
                <span>{s.full_name}</span>
                <button onClick={() => remove.mutate(s.id)} className="text-rose-600 hover:bg-rose-50 p-1 rounded"><Trash2 size={14} /></button>
              </div>
            ))}
            {(rosterQ.data || []).length === 0 && <div className="text-sm text-slate-400">Пусто</div>}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-600 uppercase mb-2">Добавить ученика</div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {candidates.map(s => (
              <button key={s.id} onClick={() => add.mutate(s.id)} className="w-full flex items-center justify-between bg-white border border-slate-200 hover:bg-brand-50 rounded-lg p-2 text-sm">
                <span>{s.full_name}</span>
                <Plus size={14} />
              </button>
            ))}
            {candidates.length === 0 && <div className="text-sm text-slate-400">Все ученики уже в группе</div>}
          </div>
        </div>
      </div>
    </Modal>
  );
}
