export type UserRole = 'admin' | 'manager' | 'teacher';
export type LeadStatus = 'new' | 'contacted' | 'trial' | 'negotiation' | 'won' | 'lost';
export type StudentStatus = 'active' | 'frozen' | 'archived' | 'graduated';
export type PaymentKind = 'income' | 'expense' | 'payout' | 'refund';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
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

export interface Note {
  id: string;
  subject_type: 'lead' | 'student' | 'group';
  subject_id: string;
  body: string;
  author_id: string | null;
  created_at: string;
}

// Supabase typed client placeholder
export type Database = {
  public: {
    Tables: {
      profiles:       { Row: Profile;     Insert: Partial<Profile>;     Update: Partial<Profile> };
      subjects:       { Row: Subject;     Insert: Partial<Subject>;     Update: Partial<Subject> };
      leads:          { Row: Lead;        Insert: Partial<Lead>;        Update: Partial<Lead> };
      students:       { Row: Student;     Insert: Partial<Student>;     Update: Partial<Student> };
      groups:         { Row: Group;       Insert: Partial<Group>;       Update: Partial<Group> };
      lessons:        { Row: Lesson;      Insert: Partial<Lesson>;      Update: Partial<Lesson> };
      attendance:     { Row: Attendance;  Insert: Partial<Attendance>;  Update: Partial<Attendance> };
      payments:       { Row: Payment;     Insert: Partial<Payment>;     Update: Partial<Payment> };
      notes:          { Row: Note;        Insert: Partial<Note>;        Update: Partial<Note> };
      group_students: {
        Row: { group_id: string; student_id: string; joined_at: string };
        Insert: { group_id: string; student_id: string; joined_at?: string };
        Update: { group_id?: string; student_id?: string; joined_at?: string };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      lead_status: LeadStatus;
      student_status: StudentStatus;
      payment_kind: PaymentKind;
      attendance_status: AttendanceStatus;
    };
  };
};
