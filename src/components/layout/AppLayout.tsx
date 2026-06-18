import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/stores/auth';
import {
  LayoutDashboard, Users, GraduationCap, CalendarDays, ClipboardCheck,
  Wallet, UserCog, BarChart3, Settings, LogOut, Menu, X, Target, Briefcase,
} from 'lucide-react';
import clsx from 'clsx';

const nav = [
  { to: '/', label: 'Дашборд', icon: LayoutDashboard, roles: ['admin','manager','teacher'] },
  { to: '/workspace', label: 'Мой кабинет', icon: Briefcase, roles: ['admin','manager'] },
  { to: '/leads', label: 'Лиды', icon: Target, roles: ['admin','manager'] },
  { to: '/students', label: 'Ученики', icon: Users, roles: ['admin','manager','teacher'] },
  { to: '/groups', label: 'Группы', icon: GraduationCap, roles: ['admin','manager','teacher'] },
  { to: '/schedule', label: 'Расписание', icon: CalendarDays, roles: ['admin','manager','teacher'] },
  { to: '/attendance', label: 'Посещаемость', icon: ClipboardCheck, roles: ['admin','manager','teacher'] },
  { to: '/finance', label: 'Финансы', icon: Wallet, roles: ['admin','manager'] },
  { to: '/teachers', label: 'Сотрудники', icon: UserCog, roles: ['admin','manager'] },
  { to: '/reports', label: 'Отчёты', icon: BarChart3, roles: ['admin','manager'] },
  { to: '/settings', label: 'Настройки', icon: Settings, roles: ['admin','manager','teacher'] },
];

const roleLabel: Record<string, string> = {
  admin: 'Администратор',
  manager: 'Менеджер продаж',
  teacher: 'Преподаватель',
};

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const role = user?.role ?? 'manager';
  const items = nav.filter(n => n.roles.includes(role));

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className={clsx(
        'fixed md:static z-40 inset-y-0 left-0 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform',
        open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      )}>
        <div className="h-16 flex items-center gap-2 px-5 border-b border-slate-100">
          <div className="bg-brand-600 text-white rounded-lg p-1.5"><GraduationCap size={20} /></div>
          <div className="font-bold text-slate-900">SmartClub CRM</div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition',
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )}
            >
              <Icon size={18} />{label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-3">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold">
              {(user?.full_name || '?').slice(0,1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-900 truncate">{user?.full_name || 'Без имени'}</div>
              <div className="text-xs text-slate-500 truncate">{roleLabel[role]}</div>
            </div>
          </div>
          <button
            onClick={() => { signOut(); navigate('/login'); }}
            className="btn-ghost w-full justify-start mt-1"
          >
            <LogOut size={16} /> Выйти
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden h-14 bg-white border-b border-slate-200 flex items-center px-3 gap-2">
          <button onClick={() => setOpen(o => !o)} className="btn-ghost p-2">
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="font-bold">SmartClub CRM</div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
