import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Group, Subject, Profile, Student } from '@/types/database';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { Link } from 'react-router-dom';
import { Plus, GraduationCap, Trash2, Edit3, Users, Download, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtMoney } from '@/lib/format';
import { exportCSV } from '@/lib/csv';
import { useAuth } from '@/stores/auth';

const empty: Partial<Group> = {
  name: '', subject_id: null, teacher_id: null, monthly_fee: 30000, capacity: 12,
  schedule_summary: '', is_active: true,
};

export default function GroupsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';
  const [editing, setEditing] = useState<Partial<Group> | null>(null);
  const [rosterFor, setRosterFor] = useState<Group | null>(null);

  const groupsQ = useQuery({
    queryKey: ['groups', isTeacher ? user?.id : 'all'],
    queryFn: () => isTeacher
      ? api.groups.list({ orderBy: 'created_at', order: 'desc', teacher_id: user!.id })
      : api.groups.list({ orderBy: 'created_at', order: 'desc' }),
  });
  const subjectsQ = useQuery({ queryKey: ['subjects'], queryFn: () => api.subjects.list({ orderBy: 'name', order: 'asc' }) });
  const usersQ    = useQuery({ queryKey: ['users-all'],queryFn: () => api.users.list() });

  const teachers = (usersQ.data || []).filter(u => u.role === 'teacher');

  const save = useMutation({
    mutationFn: (g: Partial<Group>) => g.id ? api.groups.update(g.id, g) : api.groups.create(g),
    onSuccess: () => { toast.success('Сохранено'); setEditing(null); qc.invalidateQueries({ queryKey: ['groups'] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.groups.remove(id),
    onSuccess: () => { toast.success('Удалено'); qc.invalidateQueries({ queryKey: ['groups'] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title={isTeacher ? 'Мои группы' : 'Группы и потоки'}
        subtitle={isTeacher ? 'Группы, где вы преподаватель' : 'Учебные группы по предметам ЕНТ'}
        actions={<>
          <button className="btn-secondary" onClick={() => {
            const rows = (groupsQ.data || []).map(g => ({
              ...g,
              subject: subjectsQ.data?.find(s => s.id === g.subject_id)?.name || '',
              teacher: teachers.find(t => t.id === g.teacher_id)?.full_name || '',
            }));
            exportCSV('groups', rows, [
              { key: 'name', label: 'Группа' },
              { key: 'subject', label: 'Предмет' },
              { key: 'teacher', label: 'Преподаватель' },
              { key: 'monthly_fee', label: 'Стоимость/мес' },
              { key: 'capacity', label: 'Вместимость' },
              { key: 'schedule_summary', label: 'Расписание' },
              { key: 'starts_on', label: 'Старт' },
              { key: 'ends_on', label: 'Конец' },
              { key: 'is_active', label: 'Активна', format: v => v ? 'да' : 'нет' },
            ]);
          }} disabled={!(groupsQ.data || []).length}><Download size={15} /> Экспорт CSV</button>
          {!isTeacher && <button className="btn-primary" onClick={() => setEditing({ ...empty })}><Plus size={16} /> Новая группа</button>}
        </>}
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
            const teacher = teachers.find(t => t.id === g.teacher_id);
            return (
              <div key={g.id} className="card p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <Link to={`/groups/${g.id}`} className="font-semibold text-slate-900 hover:text-brand-700 inline-flex items-center gap-1">
                      {g.name} <ExternalLink size={12} className="text-slate-400" />
                    </Link>
                    <div className="text-xs text-slate-500 mt-0.5">
                      <span style={{ color: subj?.color || '#6366f1' }}>●</span> {subj?.name || 'Без предмета'}
                    </div>
                  </div>
                  {!isTeacher && (
                    <div className="flex gap-1">
                      <button onClick={() => setEditing(g)} className="btn-ghost p-1.5"><Edit3 size={15} /></button>
                      <button onClick={() => confirm('Удалить группу?') && del.mutate(g.id)} className="btn-ghost p-1.5 text-rose-600"><Trash2 size={15} /></button>
                    </div>
                  )}
                </div>
                <div className="text-sm text-slate-600 space-y-1">
                  <div>Преподаватель: {teacher
                    ? <Link to={`/teachers/${teacher.id}`} className="text-brand-700 hover:underline font-medium">{teacher.full_name}</Link>
                    : <b className="text-slate-900">—</b>}
                  </div>
                  <div>Стоимость: <b className="text-slate-900">{fmtMoney(g.monthly_fee)}/мес</b></div>
                  <div>Расписание: {g.schedule_summary || '—'}</div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Link to={`/groups/${g.id}`} className="btn-primary flex-1 justify-center">Открыть</Link>
                  <button className="btn-secondary" onClick={() => setRosterFor(g)} title="Быстрое управление составом">
                    <Users size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <Modal
          open onClose={() => setEditing(null)}
          title={editing.id ? 'Редактировать группу' : 'Новая группа'}
          footer={<>
            <button className="btn-secondary" onClick={() => setEditing(null)}>Отмена</button>
            <button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate(editing)}>Сохранить</button>
          </>}
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
                {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
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
    queryFn: () => api.groups.roster(group.id),
  });
  const studentsQ = useQuery({
    queryKey: ['students-all'],
    queryFn: () => api.students.list({ orderBy: 'full_name', order: 'asc' }),
  });

  const add = useMutation({
    mutationFn: (sid: string) => api.groups.addStudent(group.id, sid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roster', group.id] }),
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (sid: string) => api.groups.removeStudent(group.id, sid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roster', group.id] }),
  });

  const inGroup = new Set((rosterQ.data || []).map((s: Student) => s.id));
  const candidates = (studentsQ.data || []).filter(s => !inGroup.has(s.id));

  return (
    <Modal open onClose={onClose} title={`Состав группы: ${group.name}`} size="lg">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <div className="text-xs font-semibold text-slate-600 uppercase mb-2">В группе ({(rosterQ.data || []).length})</div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {(rosterQ.data || []).map((s: Student) => (
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
