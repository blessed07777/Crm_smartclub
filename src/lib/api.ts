import type { Profile, Subject, Lead, Student, Group, Lesson, Payment, Attendance, UserRole, Task } from '@/types/database';

const TOKEN_KEY = 'smartclub_token';

// Soft singleton — exposed via api.on401 so app can wire it to navigation/store reset
let on401Handler: (() => void) | null = null;

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((init.headers as Record<string, string>) || {}),
  };
  const res = await fetch(path, { ...init, headers });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    if (res.status === 401) {
      // Token expired / invalid — wipe and notify
      localStorage.removeItem(TOKEN_KEY);
      if (on401Handler) on401Handler();
    }
    const msg = json?.error || res.statusText || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json as T;
}

const qs = (params: Record<string, any> = {}) => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') u.set(k, String(v));
  }
  const s = u.toString();
  return s ? `?${s}` : '';
};

function crud<T>(base: string) {
  return {
    list:   (params: Record<string, any> = {}) => call<T[]>(`${base}${qs(params)}`),
    get:    (id: string) => call<T>(`${base}/${id}`),
    create: (data: Partial<T>) => call<T>(base, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<T>) => call<T>(`${base}/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) => call<void>(`${base}/${id}`, { method: 'DELETE' }),
  };
}

export interface StudentProfile {
  student: Student;
  groups: (Group & { subject_name: string | null; subject_color: string | null; teacher_name: string | null })[];
  attendance: (Attendance & { lesson_at: string; lesson_topic: string | null; group_name: string })[];
  payments: Payment[];
  paid: number;
  monthlyCharge: number;
  attendancePct: number | null;
  avgScore: number | null;
}

export interface ManagerStats {
  byStatus: { status: string; count: number; value: number }[];
  monthSummary: { won_month: number; created_month: number; revenue_month: number } | null;
  stale: { id: string; full_name: string; phone: string; status: string; expected_revenue: number | null; updated_at: string }[];
  recentWon: { id: string; full_name: string; phone: string; expected_revenue: number | null; updated_at: string }[];
  total: { total: number } | null;
}

export const api = {
  token: {
    get:  () => localStorage.getItem(TOKEN_KEY),
    set:  (t: string) => localStorage.setItem(TOKEN_KEY, t),
    clear:() => localStorage.removeItem(TOKEN_KEY),
  },

  // Allow app to subscribe to 401 events (auto-redirect to /login)
  on401: (cb: () => void) => { on401Handler = cb; },

  auth: {
    canRegisterPublic: () => call<{ allowed: boolean }>('/api/auth/can-register-public'),
    login:    (email: string, password: string) =>
      call<{ token: string; user: Profile }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    register: (email: string, password: string, full_name: string, role: UserRole) =>
      call<{ token?: string; user: Profile }>('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password, full_name, role }) }),
    me:       () => call<Profile>('/api/auth/me'),
    updateMe: (data: Partial<Profile>) => call<Profile>('/api/auth/me', { method: 'PATCH', body: JSON.stringify(data) }),
    changePassword: (current_password: string, new_password: string) =>
      call<{ ok: true }>('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password, new_password }) }),
  },

  users: {
    ...crud<Profile>('/api/users'),
    list: () => call<Profile[]>('/api/users'),
  },
  subjects: crud<Subject>('/api/subjects'),
  leads:    crud<Lead>('/api/leads'),
  students: {
    ...crud<Student>('/api/students'),
    profile: (id: string) => call<StudentProfile>(`/api/students/${id}/profile`),
  },
  groups:   {
    ...crud<Group>('/api/groups'),
    roster: (id: string) => call<Student[]>(`/api/groups/${id}/roster`),
    addStudent: (groupId: string, student_id: string) =>
      call<{ ok: true }>(`/api/groups/${groupId}/roster`, { method: 'POST', body: JSON.stringify({ student_id }) }),
    removeStudent: (groupId: string, studentId: string) =>
      call<void>(`/api/groups/${groupId}/roster/${studentId}`, { method: 'DELETE' }),
  },
  lessons:  {
    ...crud<Lesson>('/api/lessons'),
    rosterWithAttendance: (id: string) =>
      call<{ students: Student[]; attendance: Attendance[] }>(`/api/lessons/${id}/roster`),
    markAttendance: (lessonId: string, data: { student_id: string; status: string; score?: number | null; comment?: string | null }) =>
      call<Attendance>(`/api/lessons/${lessonId}/attendance`, { method: 'PUT', body: JSON.stringify(data) }),
  },
  payments: crud<Payment>('/api/payments'),
  tasks:    crud<Task>('/api/tasks'),

  dashboard: {
    stats: () => call<{
      students: { active_students: number; total_students: number };
      leads: { open_leads: number; total_leads: number };
      groups: { active_groups: number; total_groups: number };
      finance30: { income: number; expense: number; net: number };
      upcoming: { id: string; group_id: string; starts_at: string; topic: string | null }[];
      daily: { day: string; kind: string; total: number }[];
      myTasks: { id: string; title: string; due_at: string | null; priority: string; status: string; kind: string }[];
      overdueTasks: number;
    }>('/api/dashboard/stats'),
  },

  manager: {
    stats: () => call<ManagerStats>('/api/manager/stats'),
  },

  teacher: {
    dashboard: () => call<{
      groups: (Group & { subject_name: string | null; subject_color: string | null; students_count: number })[];
      week: (Lesson & { group_name: string })[];
      studentCount: number;
      attendance30: { status: string; n: number }[];
      myTasks: { id: string; title: string; due_at: string | null; priority: string; status: string; kind: string }[];
    }>('/api/teacher/dashboard'),
    students: () => call<Student[]>('/api/teacher/students'),
  },

  reports: {
    monthly:      () => call<{ month: string; income: number | null; expense: number | null }[]>('/api/reports/monthly'),
    leadsFunnel:  () => call<{ name: string; value: number }[]>('/api/reports/leads-funnel'),
    groupRevenue: () => call<{ id: string; name: string; students: number; revenue: number }[]>('/api/reports/group-revenue'),
  },
};
