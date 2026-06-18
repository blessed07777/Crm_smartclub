import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/stores/auth';

import AuthLayout from '@/components/layout/AuthLayout';
import AppLayout from '@/components/layout/AppLayout';
import LoginPage from '@/pages/Login';
import RegisterPage from '@/pages/Register';
import DashboardPage from '@/pages/Dashboard';
import LeadsPage from '@/pages/Leads';
import StudentsPage from '@/pages/Students';
import StudentDetailPage from '@/pages/StudentDetail';
import GroupsPage from '@/pages/Groups';
import ManagerWorkspacePage from '@/pages/ManagerWorkspace';
import CalendarPage from '@/pages/Calendar';
import TasksPage from '@/pages/Tasks';
import SchedulePage from '@/pages/Schedule';
import AttendancePage from '@/pages/Attendance';
import FinancePage from '@/pages/Finance';
import TeachersPage from '@/pages/Teachers';
import ReportsPage from '@/pages/Reports';
import SettingsPage from '@/pages/Settings';

function RequireAuth({ children, roles }: { children: JSX.Element; roles?: string[] }) {
  const { user, initialized } = useAuth();
  if (!initialized) return <div className="p-10 text-slate-500">Загрузка…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const init = useAuth(s => s.init);
  useEffect(() => { init(); }, [init]);

  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/workspace" element={<RequireAuth roles={['admin','manager']}><ManagerWorkspacePage /></RequireAuth>} />
        <Route path="/leads" element={<RequireAuth roles={['admin','manager']}><LeadsPage /></RequireAuth>} />
        <Route path="/students" element={<StudentsPage />} />
        <Route path="/students/:id" element={<StudentDetailPage />} />
        <Route path="/groups" element={<GroupsPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/finance" element={<RequireAuth roles={['admin','manager']}><FinancePage /></RequireAuth>} />
        <Route path="/teachers" element={<RequireAuth roles={['admin','manager']}><TeachersPage /></RequireAuth>} />
        <Route path="/reports" element={<RequireAuth roles={['admin','manager']}><ReportsPage /></RequireAuth>} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
