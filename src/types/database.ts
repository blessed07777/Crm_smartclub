export type UserRole = 'admin' | 'manager' | 'teacher';
export type LeadStatus = 'new' | 'contacted' | 'trial' | 'negotiation' | 'won' | 'lost';
export type StudentStatus = 'active' | 'frozen' | 'archived' | 'graduated';
export type PaymentKind = 'income' | 'expense' | 'payout' | 'refund';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type TaskKind = 'task' | 'plan';
export type TaskStatus = 'open' | 'in_progress' | 'done' | 'canceled';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  kind: TaskKind;
  status: TaskStatus;
  priority: TaskPriority;
  due_at: string | null;
  assigned_to: string | null;
  created_by: string | null;
  related_type: string | null;
  related_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email?: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  specialty?: string | null;
  workplace?: string | null;
  avatar_url?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Subject {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
}

export interface Lead {
  id: string;
  full_name: string;
  phone: string;
  parent_name: string | null;
  parent_phone: string | null;
  grade: number | null;
  target_subjects: string[] | null;
  source: string | null;
  status: LeadStatus;
  note: string | null;
  assigned_to: string | null;
  expected_revenue: number | null;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  full_name: string;
  phone: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  grade: number | null;
  school: string | null;
  status: StudentStatus;
  target_score: number | null;
  note: string | null;
  enrolled_at: string;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: string;
  name: string;
  subject_id: string | null;
  teacher_id: string | null;
  monthly_fee: number;
  capacity: number | null;
  schedule_summary: string | null;
  starts_on: string | null;
  ends_on: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Lesson {
  id: string;
  group_id: string;
  starts_at: string;
  ends_at: string;
  topic: string | null;
  homework: string | null;
  is_canceled: boolean;
  created_at: string;
}

export interface Attendance {
  lesson_id: string;
  student_id: string;
  status: AttendanceStatus;
  score: number | null;
  comment: string | null;
  recorded_by: string | null;
  recorded_at: string;
}

export interface Payment {
  id: string;
  kind: PaymentKind;
  amount: number;
  currency: string;
  student_id: string | null;
  group_id: string | null;
  teacher_id: string | null;
  category: string | null;
  method: string | null;
  description: string | null;
  paid_at: string;
  created_by: string | null;
  created_at: string;
}
