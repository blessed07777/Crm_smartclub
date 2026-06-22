import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Profile, UserRole } from '@/types/database';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';
import { UserCog, Power, UserPlus, Download, Trash2, Edit3 } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtDate } from '@/lib/format';
import { exportCSV } from '@/lib/csv';
import { useAuth } from '@/stores/auth';

const ROLE: Record<UserRole, { label: string; tone: string }> = {
  admin:   { label: 'Администратор', tone: 'badge-violet' },
  manager: { label: 'Менеджер',      tone: 'badge-blue' },
  teacher: { label: 'Преподаватель', tone: 'badge-green' },
};

const COMMON_SUBJECTS = [
  'Математика','Физика','Химия','Биология','История Казахстана','Грамотность чтения',
  'Математическая грамотность','Английский язык','Казахский язык','Русский язык','Информатика',
];

export default function TeachersPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);

  const usersQ = useQuery({ queryKey: ['users'], queryFn: () => api.users.list() });

  const update = useMutation({
    mutationFn: (p: Partial<Profile> & { id: string }) => api.users.update(p.id, p),
    onSuccess: () => { toast.success('Обновлено'); setEditing(null); qc.invalidateQueries({ queryKey: ['users'] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.users.remove(id),
    onSuccess: () => { toast.success('Удалено'); qc.invalidateQueries({ queryKey: ['users'] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const exportAll = () => {
    if (!usersQ.data?.length) return;
    exportCSV('staff', usersQ.data as any, [
      { key: 'full_name', label: 'ФИО' },
      { key: 'email', label: 'Email' },
      { key: 'role', label: 'Роль', format: v => ROLE[v as UserRole]?.label || v },
      { key: 'specialty', label: 'Предмет / специализация' },
      { key: 'workplace', label: 'Место работы' },
      { key: 'phone', label: 'Телефон' },
      { key: 'is_active', label: 'Активен', format: v => v ? 'да' : 'нет' },
      { key: 'created_at', label: 'Создан', format: v => fmtDate(v) },
    ]);
  };

  return (
    <div>
      <PageHeader
        title="Сотрудники"
        subtitle="Преподаватели, менеджеры и администраторы школы"
        actions={
          <>
            <button className="btn-secondary" onClick={exportAll}><Download size={15} /> Экспорт CSV</button>
            {isAdmin && <button className="btn-primary" onClick={() => setAdding(true)}><UserPlus size={15} /> Добавить сотрудника</button>}
          </>
        }
      />

      {usersQ.isLoading ? <div className="text-slate-500">Загрузка…</div>
       : (usersQ.data || []).length === 0 ? (
        <EmptyState icon={<UserCog size={24} />} title="Сотрудников пока нет"
          hint="Добавьте преподавателя или менеджера, чтобы они могли войти."
          action={isAdmin && <button className="btn-primary" onClick={() => setAdding(true)}><UserPlus size={15} /> Добавить</button>}
        />
       ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-th">ФИО</th>
                <th className="table-th">Роль</th>
                <th className="table-th">Предмет</th>
                <th className="table-th">Место работы</th>
                <th className="table-th">Email</th>
                <th className="table-th">Телефон</th>
                <th className="table-th">Статус</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody>
              {(usersQ.data || []).map((p: Profile) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="table-td font-medium">{p.full_name || '—'}</td>
                  <td className="table-td">
                    {isAdmin ? (
                      <select
                        className="input w-40 py-1"
                        value={p.role}
                        onChange={e => update.mutate({ id: p.id, role: e.target.value as UserRole })}
                      >
                        {Object.entries(ROLE).map(([v,{label}]) => <option key={v} value={v}>{label}</option>)}
                      </select>
                    ) : (
                      <span className={ROLE[p.role].tone}>{ROLE[p.role].label}</span>
                    )}
                  </td>
                  <td className="table-td text-slate-700">{p.specialty || '—'}</td>
                  <td className="table-td text-slate-700">{p.workplace || '—'}</td>
                  <td className="table-td text-slate-500 text-xs">{p.email || '—'}</td>
                  <td className="table-td">{p.phone || '—'}</td>
                  <td className="table-td"><span className={p.is_active ? 'badge-green' : 'badge-slate'}>{p.is_active ? 'Активен' : 'Отключён'}</span></td>
                  <td className="table-td text-right whitespace-nowrap">
                    {isAdmin && (
                      <>
                        <button onClick={() => setEditing(p)} className="btn-ghost p-1.5" title="Редактировать"><Edit3 size={15} /></button>
                        <button
                          onClick={() => update.mutate({ id: p.id, is_active: !p.is_active })}
                          className="btn-ghost p-1.5"
                          title={p.is_active ? 'Отключить' : 'Активировать'}
                        >
                          <Power size={15} />
                        </button>
                        {p.id !== user?.id && (
                          <button
                            onClick={() => confirm(`Удалить «${p.full_name}»? Это действие нельзя отменить.`) && remove.mutate(p.id)}
                            className="btn-ghost p-1.5 text-rose-600"
                            title="Удалить"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
       )}

      {adding && (
        <AddStaffModal onClose={() => setAdding(false)} onSaved={() => { setAdding(false); qc.invalidateQueries({ queryKey: ['users'] }); }} />
      )}

      {editing && (
        <EditStaffModal value={editing} saving={update.isPending} onClose={() => setEditing(null)} onSave={p => update.mutate(p as any)} />
      )}
    </div>
  );
}

function EditStaffModal({ value, saving, onClose, onSave }: {
  value: Profile; saving: boolean; onClose: () => void; onSave: (p: Partial<Profile> & { id: string }) => void;
}) {
  const [form, setForm] = useState<Profile>(value);
  return (
    <Modal open onClose={onClose} title={`Редактировать: ${value.full_name}`}
      footer={<>
        <button className="btn-secondary" onClick={onClose}>Отмена</button>
        <button className="btn-primary" disabled={saving} onClick={() => onSave({
          id: value.id,
          full_name: form.full_name,
          phone: form.phone,
          email: form.email,
          specialty: form.specialty ?? null,
          workplace: form.workplace ?? null,
        })}>Сохранить</button>
      </>}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className="label">ФИО</label><input className="input" value={form.full_name||''} onChange={e=>setForm({...form, full_name: e.target.value})} /></div>
        <div><label className="label">Email</label><input type="email" className="input" value={form.email||''} onChange={e=>setForm({...form, email: e.target.value})} /></div>
        <div><label className="label">Телефон</label><input className="input" value={form.phone||''} onChange={e=>setForm({...form, phone: e.target.value})} /></div>
        <div>
          <label className="label">Предмет / специализация</label>
          <input className="input" list="subjects-suggest" value={form.specialty||''} onChange={e=>setForm({...form, specialty: e.target.value})} placeholder="математика, физика…" />
          <datalist id="subjects-suggest">
            {COMMON_SUBJECTS.map(s => <option key={s} value={s} />)}
          </datalist>
        </div>
        <div><label className="label">Место работы</label><input className="input" value={form.workplace||''} onChange={e=>setForm({...form, workplace: e.target.value})} placeholder="РФМШ, БИЛ, Smart Club…" /></div>
      </div>
    </Modal>
  );
}

function AddStaffModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('manager');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!email || !password || password.length < 6) {
      toast.error('Заполните email и пароль (мин. 6 символов)');
      return;
    }
    setSaving(true);
    try {
      await api.auth.register(email.trim(), password, fullName.trim() || email, role);
      toast.success(`Сотрудник добавлен. Логин: ${email}`);
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Добавить сотрудника" footer={
      <>
        <button className="btn-secondary" onClick={onClose}>Отмена</button>
        <button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Создаём…' : 'Создать аккаунт'}</button>
      </>
    }>
      <div className="space-y-3">
        <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-lg p-3">
          Сотрудник сразу сможет войти с указанными email и паролем.
          Передайте ему данные лично — пароль виден только при создании.
          Предмет и место работы можно заполнить после создания через «Редактировать».
        </div>
        <div><label className="label">ФИО</label><input className="input" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Айгерим Серикова" /></div>
        <div><label className="label">Email *</label><input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} required /></div>
        <div><label className="label">Временный пароль *</label><input type="text" className="input" value={password} onChange={e => setPassword(e.target.value)} placeholder="мин. 6 символов" required minLength={6} /></div>
        <div>
          <label className="label">Роль</label>
          <select className="input" value={role} onChange={e => setRole(e.target.value as UserRole)}>
            <option value="manager">Менеджер продаж</option>
            <option value="teacher">Преподаватель</option>
            <option value="admin">Администратор</option>
          </select>
        </div>
      </div>
    </Modal>
  );
}
