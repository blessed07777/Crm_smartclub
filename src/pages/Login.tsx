import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/stores/auth';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { Mail, Lock, LogIn } from 'lucide-react';

export default function LoginPage() {
  const { signIn, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [canPublicRegister, setCanPublicRegister] = useState(false);

  useEffect(() => {
    api.auth.canRegisterPublic()
      .then(r => setCanPublicRegister(r.allowed))
      .catch(() => setCanPublicRegister(false));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signIn(email.trim(), password);
      toast.success('Добро пожаловать!');
    } catch (err: any) {
      toast.error(err?.message || 'Ошибка входа');
    }
  };

  return (
    <div>
      <h2 className="text-3xl font-bold text-slate-900">Вход в SmartClub</h2>
      <p className="text-sm text-slate-500 mt-1">Войдите в свой аккаунт CRM</p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <div>
          <label className="label">Email</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="input pl-9" placeholder="you@school.kz"
            />
          </div>
        </div>
        <div>
          <label className="label">Пароль</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="password" required value={password} onChange={e => setPassword(e.target.value)}
              className="input pl-9" placeholder="••••••••"
            />
          </div>
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
          <LogIn size={16} /> {loading ? 'Входим…' : 'Войти'}
        </button>
      </form>

      {canPublicRegister ? (
        <p className="text-sm text-slate-500 mt-6 text-center">
          Первый запуск? <Link to="/register" className="text-brand-600 font-medium hover:underline">Создать аккаунт администратора</Link>
        </p>
      ) : (
        <p className="text-xs text-slate-400 mt-6 text-center">
          Нет аккаунта? Обратитесь к администратору школы для приглашения.
        </p>
      )}
    </div>
  );
}
