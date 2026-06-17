import { useState, useEffect } from 'react';
import { useAuth } from '@/stores/auth';
import { supabase } from '@/lib/supabase';
import PageHeader from '@/components/ui/PageHeader';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
    }
  }, [profile]);

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ full_name: fullName, phone }).eq('id', profile.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success('Сохранено'); refreshProfile(); }
  };

  return (
    <div>
      <PageHeader title="Настройки профиля" subtitle="Личные данные и аккаунт" />

      <div className="card p-6 max-w-xl">
        <div className="space-y-4">
          <div><label className="label">Email</label><input className="input" value={profile?.id ? '' : ''} placeholder="—" disabled /></div>
          <div><label className="label">ФИО</label><input className="input" value={fullName} onChange={e => setFullName(e.target.value)} /></div>
          <div><label className="label">Телефон</label><input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 700 000 0000" /></div>
          <div><label className="label">Роль</label><input className="input" value={profile?.role || ''} disabled /></div>
          <button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Сохраняем…' : 'Сохранить'}</button>
        </div>
      </div>

      <div className="card p-6 max-w-xl mt-6">
        <h3 className="font-semibold mb-2">О системе</h3>
        <p className="text-sm text-slate-600">SmartClub CRM — CRM для подготовительной школы к ЕНТ.</p>
        <ul className="text-sm text-slate-600 mt-2 space-y-1 list-disc pl-5">
          <li>Stack: React 18 + TypeScript + Vite + TailwindCSS</li>
          <li>Backend: Supabase (PostgreSQL + JWT Auth + RLS)</li>
          <li>UI-kit: lucide-react · recharts · react-query · zustand</li>
        </ul>
      </div>
    </div>
  );
}
