import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { exportCSV } from '@/lib/csv';
import type { Student, StudentStatus } from '@/types/database';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { Plus, Users, Trash2, Edit3, Search, Download, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtDate } from '@/lib/format';

const STATUS_LABELS: Record<StudentStatus, { label: string; tone: string }> = {
  active:    { label: 'Учится',     tone: 'badge-green' },
  frozen:    { label: 'Заморозка',  tone: 'badge-amber' },
  archived:  { label: 'Архив',      tone: 'badge-slate' },
  graduated: { label: 'Выпускник',  tone: 'badge-violet' },
};

const empty: Partial<Student> = {
  full_name: '', phone: '', parent_name: '', parent_phone: '',
  grade: undefined, school: '', status: 'active', target_score: undefined, note: '',
};

export default function StudentsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Student> | null>(null);
  const [q, setQ] = useState('');

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students'],
    queryFn: () => api.students.list({ orderBy: 'full_name', order: 'asc' }),
  });

  const save = useMutation({
    mutationFn: (s: Partial<Student>) => s.id ? api.students.update(s.id, s) : api.students.create(s),
    onSuccess: () => { toast.success('Сохранено'); setEditing(null); qc.invalidateQueries({ queryKey: ['students'] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.students.remove(id),
    onSuccess: () => { toast.success('Удалено'); qc.invalidateQueries({ queryKey: ['students'] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = students.filter(s =>
    !q || s.full_name.toLowerCase().includes(q.toLowerCase()) || (s.phone||'').includes(q),
  );

  const onExport = () => {
    exportCSV('students', filtered, [
      { key: 'full_name', label: 'ФИО' },
      { key: 'phone', label: 'Телефон ученика' },
      { key: 'parent_name', label: 'Родитель' },
      { key: 'parent_phone', label: 'Тел. родителя' },
      { key: 'grade', label: 'Класс' },
      { key: 'school', label: 'Школа' },
      { key: 'target_score', label: 'Цель ЕНТ' },
      { key: 'status', label: 'Статус', format: v => STATUS_LABELS[v as StudentStatus]?.label || v },
      { key: 'enrolled_at', label: 'Зачислен', format: v => fmtDate(v) },
      { key: 'note', label: 'Заметка' },
    ]);
  };

  return (
    <div>
      <PageHeader
        title="Ученики"
        subtitle="Карточки всех учеников школы"
        actions={<>
          <button className="btn-secondary" onClick={onExport} disabled={!filtered.length}><Download size={15} /> Экспорт CSV</button>
          <button className="btn-primary" onClick={() => setEditing({ ...empty })}><Plus size={16} /> Добавить ученика</button>
        </>}
      />

      <div className="card p-4 mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input className="input pl-9" placeholder="Поиск по ФИО или телефону…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="text-sm text-slate-500">Всего: <b>{students.length}</b></div>
      </div>

      {isLoading ? (
        <div className="text-slate-500">Загрузка…</div>
      ) : students.length === 0 ? (
        <EmptyState
          icon={<Users size={24} />}
          title="Учеников пока нет"
          hint="Добавьте первого ученика или конвертируйте лид со статусом «Купил»."
          action={<button className="btn-primary" onClick={() => setEditing({ ...empty })}><Plus size={16} /> Добавить ученика</button>}
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-th">ФИО</th>
                <th className="table-th">Класс</th>
                <th className="table-th">Школа</th>
                <th className="table-th">Телефон</th>
                <th className="table-th">Цель ЕНТ</th>
                <th className="table-th">Зачислен</th>
                <th className="table-th">Статус</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="table-td font-medium text-slate-900">
                    <Link to={`/students/${s.id}`} className="text-brand-700 hover:underline inline-flex items-center gap-1">
                      {s.full_name} <ExternalLink size={12} className="text-slate-400" />
                    </Link>
                  </td>
                  <td className="table-td">{s.grade ?? '—'}</td>
                  <td className="table-td">{s.school || '—'}</td>
                  <td className="table-td">{s.phone || s.parent_phone || '—'}</td>
                  <td className="table-td">{s.target_score ?? '—'}</td>
                  <td className="table-td">{fmtDate(s.enrolled_at)}</td>
                  <td className="table-td"><span className={STATUS_LABELS[s.status].tone}>{STATUS_LABELS[s.status].label}</span></td>
                  <td className="table-td text-right">
                    <Link to={`/students/${s.id}`} className="btn-ghost p-1.5 inline-flex" title="Открыть карточку"><ExternalLink size={15} /></Link>
                    <button onClick={() => setEditing(s)} className="btn-ghost p-1.5"><Edit3 size={15} /></button>
                    <button onClick={() => confirm(`Удалить «${s.full_name}»?`) && del.mutate(s.id)} className="btn-ghost p-1.5 text-rose-600"><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Modal
          open
          onClose={() => setEditing(null)}
          title={editing.id ? 'Редактировать ученика' : 'Новый ученик'}
          size="lg"
          footer={<>
            <button className="btn-secondary" onClick={() => setEditing(null)}>Отмена</button>
            <button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate(editing)}>{save.isPending ? 'Сохраняем…' : 'Сохранить'}</button>
          </>}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">ФИО *</label><input className="input" value={editing.full_name||''} onChange={e=>setEditing({...editing, full_name: e.target.value})} required /></div>
            <div><label className="label">Телефон</label><input className="input" value={editing.phone||''} onChange={e=>setEditing({...editing, phone: e.target.value})} /></div>
            <div><label className="label">Класс</label><input type="number" min={1} max={12} className="input" value={editing.grade ?? ''} onChange={e=>setEditing({...editing, grade: e.target.value ? Number(e.target.value) : null})} /></div>
            <div><label className="label">Родитель</label><input className="input" value={editing.parent_name||''} onChange={e=>setEditing({...editing, parent_name: e.target.value})} /></div>
            <div><label className="label">Телефон родителя</label><input className="input" value={editing.parent_phone||''} onChange={e=>setEditing({...editing, parent_phone: e.target.value})} /></div>
            <div><label className="label">Школа</label><input className="input" value={editing.school||''} onChange={e=>setEditing({...editing, school: e.target.value})} /></div>
            <div><label className="label">Цель по ЕНТ (баллы)</label><input type="number" className="input" value={editing.target_score ?? ''} onChange={e=>setEditing({...editing, target_score: e.target.value ? Number(e.target.value) : null})} /></div>
            <div>
              <label className="label">Статус</label>
              <select className="input" value={editing.status||'active'} onChange={e=>setEditing({...editing, status: e.target.value as StudentStatus})}>
                {Object.entries(STATUS_LABELS).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
            <div><label className="label">Дата зачисления</label><input type="date" className="input" value={editing.enrolled_at || new Date().toISOString().slice(0,10)} onChange={e=>setEditing({...editing, enrolled_at: e.target.value})} /></div>
            <div className="col-span-2"><label className="label">Заметка</label><textarea className="input" rows={3} value={editing.note||''} onChange={e=>setEditing({...editing, note: e.target.value})} /></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
