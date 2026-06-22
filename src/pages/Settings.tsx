import { useState, useEffect } from 'react';
import { useAuth } from '@/stores/auth';
import { api } from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  const save = async () => {
    const name = fullName.trim();
    if (!name) { toast.error('ФИО не может быть пустым'); return; }
    setSaving(true);
    try {
      await api.auth.updateMe({ full_name: name, phone: phone.trim() });
      toast.success('Сохранено');
      refreshProfile();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const changePw = async () => {
    if (newPw.length < 6) { toast.error('Минимум 6 символов'); return; }
    setPwSaving(true);
    try {
      await api.auth.changePassword(currentPw, newPw);
      toast.success('Пароль обновлён');
      setCurrentPw(''); setNewPw('');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Настройки профиля" subtitle="Личные данные и аккаунт" />

      <div className="grid lg:grid-cols-2 gap-6 max-w-4xl">
        <div className="card p-6">
          <h3 className="font-semibold mb-4">Личные данные</h3>
          <div className="space-y-4">
            <div><label className="label">Email</label><input className="input" value={(user as any)?.email || ''} disabled /></div>
            <div><label className="label">ФИО</label><input className="input" value={fullName} onChange={e => setFullName(e.target.value)} /></div>
            <div><label className="label">Телефон</label><input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 700 000 0000" /></div>
            <div><label className="label">Роль</label><input className="input" value={user?.role || ''} disabled /></div>
            <button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Сохраняем…' : 'Сохранить'}</button>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="font-semibold mb-4">Смена пароля</h3>
          <div className="space-y-4">
            <div><label className="label">Текущий пароль</label><input type="password" className="input" value={currentPw} onChange={e => setCurrentPw(e.target.value)} /></div>
            <div><label className="label">Новый пароль (мин. 6)</label><input type="password" className="input" value={newPw} onChange={e => setNewPw(e.target.value)} /></div>
            <button className="btn-primary" disabled={pwSaving} onClick={changePw}>{pwSaving ? 'Меняем…' : 'Сменить пароль'}</button>
          </div>
        </div>
      </div>

      <div className="card p-6 max-w-4xl mt-6">
        <h3 className="font-semibold mb-2">О системе</h3>
        <p className="text-sm text-slate-600">SmartClub CRM — CRM для подготовительной школы к ЕНТ.</p>
        <ul className="text-sm text-slate-600 mt-2 space-y-1 list-disc pl-5">
          <li>Stack: React 18 + TypeScript + Vite + TailwindCSS</li>
          <li>Backend: Node.js + Express + PostgreSQL (Railway) + JWT (bcryptjs)</li>
          <li>UI-kit: lucide-react · recharts · react-query · zustand</li>
        </ul>
      </div>
    </div>
  );
}
