import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/stores/auth';
import type { UserRole } from '@/types/database';
import toast from 'react-hot-toast';
import { UserPlus } from 'lucide-react';

export default function RegisterPage() {
  const { signUp, loading } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('manager');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signUp(email.trim(), password, fullName.trim(), role);
      toast.success('Аккаунт создан');
    } catch (err: any) {
      toast.error(err?.message || 'Ошибка регистрации');
    }
  };

  return (
    <div>
      <h2 className="text-3xl font-bold text-slate-900">Регистрация</h2>
      <p className="text-sm text-slate-500 mt-1">
        Первый зарегистрированный пользователь становится администратором.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4">
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
        <div>
          <label className="label">Роль</label>
          <select className="input" value={role} onChange={e => setRole(e.target.value as UserRole)}>
            <option value="manager">Менеджер продаж</option>
            <option value="teacher">Преподаватель</option>
            <option value="admin">Администратор</option>
          </select>
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
