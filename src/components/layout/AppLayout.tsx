import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/stores/auth';
import {
  LayoutDashboard, Users, GraduationCap, CalendarDays, ClipboardCheck,
  Wallet, UserCog, BarChart3, Settings, LogOut, Menu, X, Target, Briefcase,
  CalendarRange, ClipboardList,
} from 'lucide-react';
import clsx from 'clsx';

type NavItem = { to: string; label: string; icon: any; roles: string[]; end?: boolean };
type NavSection = { label?: string; items: NavItem[] };

const sections: NavSection[] = [
  {
    items: [
      { to: '/', label: 'Главная', icon: LayoutDashboard, roles: ['admin','manager','teacher'], end: true },
    ],
  },
  {
    label: 'Продажи',
    items: [
      { to: '/workspace', label: 'Мой кабинет', icon: Briefcase, roles: ['admin'] }, // admin can peek
      { to: '/leads',     label: 'Лиды',        icon: Target,    roles: ['admin','manager'] },
      { to: '/students',  label: 'Ученики',     icon: Users,     roles: ['admin','manager'] },
      { to: '/finance',   label: 'Финансы',     icon: Wallet,    roles: ['admin','manager'] },
    ],
  },
  {
    label: 'Учебный процесс',
    items: [
      { to: '/students',   label: 'Мои ученики',   icon: Users,         roles: ['teacher'] },
      { to: '/groups',     label: 'Группы',        icon: GraduationCap, roles: ['admin'] },
      { to: '/groups',     label: 'Мои группы',    icon: GraduationCap, roles: ['teacher'] },
      { to: '/calendar',   label: 'Календарь',     icon: CalendarRange, roles: ['admin','teacher'] },
      { to: '/schedule',   label: 'Расписание',    icon: CalendarDays,  roles: ['admin'] },
      { to: '/attendance', label: 'Посещаемость',  icon: ClipboardCheck,roles: ['admin','teacher'] },
    ],
  },
  {
    label: 'Личное',
    items: [
      { to: '/tasks',    label: 'Задачи и планы', icon: ClipboardList, roles: ['admin','manager','teacher'] },
      { to: '/settings', label: 'Настройки',      icon: Settings,      roles: ['admin','manager','teacher'] },
    ],
  },
  {
    label: 'Администрирование',
    items: [
      { to: '/teachers', label: 'Сотрудники', icon: UserCog,   roles: ['admin','manager'] },
      { to: '/reports',  label: 'Отчёты',     icon: BarChart3, roles: ['admin','manager'] },
    ],
  },
];

const roleLabel: Record<string, string> = {
  admin: 'Администратор',
  manager: 'Менеджер продаж',
  teacher: 'Преподаватель',
};

const roleBadge: Record<string, string> = {
  admin: 'bg-violet-100 text-violet-700',
  manager: 'bg-blue-100 text-blue-700',
  teacher: 'bg-emerald-100 text-emerald-700',
};

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const role = user?.role ?? 'manager';

  const visibleSections = sections
    .map(s => ({ ...s, items: s.items.filter(i => i.roles.includes(role)) }))
    .filter(s => s.items.length > 0);

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

        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
          {visibleSections.map((s, i) => (
            <div key={i}>
              {s.label && (
                <div className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{s.label}</div>
              )}
              <div className="space-y-0.5">
                {s.items.map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={`${to}-${label}`}
                    to={to}
                    end={end}
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
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-3">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold">
              {(user?.full_name || '?').slice(0,1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-900 truncate">{user?.full_name || 'Без имени'}</div>
              <div className={clsx('text-[10px] font-semibold uppercase tracking-wider inline-block px-1.5 py-0.5 rounded mt-0.5', roleBadge[role])}>
                {roleLabel[role]}
              </div>
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
