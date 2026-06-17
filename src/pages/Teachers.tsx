import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Profile, UserRole } from '@/types/database';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { UserCog, Power } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtDate } from '@/lib/format';

const ROLE: Record<UserRole, { label: string; tone: string }> = {
  admin:   { label: 'Администратор', tone: 'badge-violet' },
  manager: { label: 'Менеджер',      tone: 'badge-blue' },
  teacher: { label: 'Преподаватель', tone: 'badge-green' },
};

export default function TeachersPage() {
  const qc = useQueryClient();

  const profilesQ = useQuery({ queryKey: ['profiles'], queryFn: async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) throw error; return data as Profile[];
  }});

  const update = useMutation({
    mutationFn: async (p: Partial<Profile> & { id: string }) => {
      const { error } = await supabase.from('profiles').update(p).eq('id', p.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Обновлено'); qc.invalidateQueries({ queryKey: ['profiles'] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader title="Сотрудники" subtitle="Преподаватели, менеджеры и администраторы школы" />

      {profilesQ.isLoading ? <div className="text-slate-500">Загрузка…</div>
       : (profilesQ.data || []).length === 0 ? (
        <EmptyState icon={<UserCog size={24} />} title="Сотрудников пока нет" hint="Сотрудники появляются здесь после регистрации." />
       ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-th">ФИО</th>
                <th className="table-th">Роль</th>
                <th className="table-th">Телефон</th>
                <th className="table-th">Создан</th>
                <th className="table-th">Статус</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody>
              {(profilesQ.data || []).map(p => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="table-td font-medium">{p.full_name || '—'}</td>
                  <td className="table-td">
                    <select
                      className="input w-44 py-1"
                      value={p.role}
                      onChange={e => update.mutate({ id: p.id, role: e.target.value as UserRole })}
                    >
                      {Object.entries(ROLE).map(([v,{label}]) => <option key={v} value={v}>{label}</option>)}
                    </select>
                  </td>
                  <td className="table-td">{p.phone || '—'}</td>
                  <td className="table-td">{fmtDate(p.created_at)}</td>
                  <td className="table-td"><span className={p.is_active ? 'badge-green' : 'badge-slate'}>{p.is_active ? 'Активен' : 'Отключён'}</span></td>
                  <td className="table-td text-right">
                    <button
                      onClick={() => update.mutate({ id: p.id, is_active: !p.is_active })}
                      className="btn-ghost p-1.5"
                      title={p.is_active ? 'Отключить' : 'Активировать'}
                    >
                      <Power size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
       )}
    </div>
  );
}
