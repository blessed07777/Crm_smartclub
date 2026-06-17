import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/stores/auth';
import { GraduationCap } from 'lucide-react';

export default function AuthLayout() {
  const { session, initialized } = useAuth();
  if (initialized && session) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex flex-col justify-between bg-gradient-to-br from-brand-700 to-brand-900 text-white p-12">
        <div className="flex items-center gap-3 font-bold text-2xl">
          <GraduationCap size={32} />
          SmartClub CRM
        </div>
        <div>
          <h1 className="text-4xl font-extrabold leading-tight mb-4">
            Подготовка к ЕНТ нового поколения
          </h1>
          <p className="text-brand-100 text-lg max-w-md">
            CRM-система для топ-школ Казахстана. Управление учениками, расписанием,
            оплатами и преподавателями — в одном месте.
          </p>
          <ul className="mt-8 space-y-2 text-brand-100">
            <li>· Воронка продаж и лиды</li>
            <li>· Учёт посещаемости и оценок</li>
            <li>· Финансы и зарплаты преподавателей</li>
            <li>· Аналитика по группам и доходам</li>
          </ul>
        </div>
        <div className="text-brand-200 text-sm">© SmartClub · {new Date().getFullYear()}</div>
      </div>

      <div className="flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
