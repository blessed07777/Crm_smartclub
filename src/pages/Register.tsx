import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/stores/auth';
import { api } from '@/lib/api';
import type { UserRole } from '@/types/database';
import toast from 'react-hot-toast';
import { UserPlus, ShieldCheck, Lock } from 'lucide-react';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { signUp, loading } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('admin');
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    api.auth.canRegisterPublic()
      .then(r => setAllowed(r.allowed))
      .catch(() => setAllowed(false));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signUp(email.trim(), password, fullName.trim(), role);
      toast.success('Аккаунт создан');
    } catch (err: any) {
      toast.error(err?.message || 'Ошибка регистрации');
    }
  };

  if (allowed === null) {
    return <div className="text-slate-500">Проверяем…</div>;
  }

  if (allowed === false) {
    return (
      <div className="text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
          <Lock size={24} />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Регистрация закрыта</h2>
        <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">
          Открытая регистрация недоступна. Новых сотрудников создаёт только администратор школы — обратитесь к нему за приглашением.
        </p>
        <button className="btn-primary mt-6 mx-auto" onClick={() => navigate('/login')}>
          Войти в аккаунт
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-4 flex items-start gap-2">
        <ShieldCheck size={18} className="text-emerald-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-emerald-800">
          <b>Это первая регистрация.</b> Аккаунт автоматически получит роль <b>администратора</b>.
          Все следующие сотрудники добавляются только из админ-панели.
        </div>
      </div>

      <h2 className="text-3xl font-bold text-slate-900">Создать аккаунт администратора</h2>
      <p className="text-sm text-slate-500 mt-1">
        Заведите свой первый аккаунт школы
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label className="label">ФИО</label>
          <input className="input" required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Айгерим Серикова" />
        </div>
        <div>
          <label className="label">Email</label>
          <input type="email" className="input" required value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label">Пароль (мин. 6 символов)</label>
          <input type="password" className="input" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
          <UserPlus size={16} /> {loading ? 'Создаём…' : 'Создать аккаунт'}
        </button>
      </form>

      <p className="text-sm text-slate-500 mt-6 text-center">
        Уже есть аккаунт? <Link to="/login" className="text-brand-600 font-medium hover:underline">Войти</Link>
      </p>
    </div>
  );
}
