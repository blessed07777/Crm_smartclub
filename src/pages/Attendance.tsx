import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Lesson, AttendanceStatus } from '@/types/database';
import { useAuth } from '@/stores/auth';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { ClipboardCheck, Check, X, Clock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtDateTime } from '@/lib/format';

const STATUS: { value: AttendanceStatus; label: string; icon: any; tone: string }[] = [
  { value: 'present', label: 'Был',     icon: Check,       tone: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  { value: 'absent',  label: 'Нет',     icon: X,           tone: 'bg-rose-100 text-rose-700 border-rose-300' },
  { value: 'late',    label: 'Опоздал', icon: Clock,       tone: 'bg-amber-100 text-amber-700 border-amber-300' },
  { value: 'excused', label: 'Уваж.',   icon: AlertCircle, tone: 'bg-blue-100 text-blue-700 border-blue-300' },
];

export default function AttendancePage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';
  const [lessonId, setLessonId] = useState<string>('');

  const lessonsQ = useQuery({ queryKey: ['lessons-recent'], queryFn: () => api.lessons.list({ orderBy: 'starts_at', order: 'desc', limit: 100 }) });
  const groupsQ  = useQuery({
    queryKey: ['groups-att', isTeacher ? user?.id : 'all'],
    enabled: isTeacher,
    queryFn: () => api.groups.list({ limit: 1000, teacher_id: user!.id }),
  });
  const myGroupIds = useMemo(() => new Set((groupsQ.data || []).map(g => g.id)), [groupsQ.data]);
  const visibleLessons = (lessonsQ.data || []).filter(l => !isTeacher || myGroupIds.has(l.group_id));
  const rosterQ = useQuery({
    queryKey: ['lesson-roster', lessonId],
    enabled: !!lessonId,
    queryFn: () => api.lessons.rosterWithAttendance(lessonId),
  });

  const mark = useMutation({
    mutationFn: ({ studentId, status, score }: { studentId: string; status: AttendanceStatus; score?: number | null }) =>
      api.lessons.markAttendance(lessonId, { student_id: studentId, status, score: score ?? null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lesson-roster', lessonId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const getAtt = (sid: string) => rosterQ.data?.attendance.find(a => a.student_id === sid);

  return (
    <div>
      <PageHeader title="Посещаемость" subtitle="Отметка присутствия и оценок по урокам" />

      <div className="card p-4 mb-4">
        <label className="label">Выберите урок</label>
        <select className="input max-w-2xl" value={lessonId} onChange={e => setLessonId(e.target.value)}>
          <option value="">—</option>
          {visibleLessons.map((l: Lesson) => (
            <option key={l.id} value={l.id}>{fmtDateTime(l.starts_at)} — {l.topic || 'Без темы'}</option>
          ))}
        </select>
      </div>

      {!lessonId ? (
        <EmptyState icon={<ClipboardCheck size={24} />} title="Выберите урок" hint="Выберите урок из списка выше, чтобы отметить посещаемость." />
      ) : rosterQ.isLoading ? (
        <div className="text-slate-500">Загрузка состава…</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-th">Ученик</th>
                <th className="table-th">Статус</th>
                <th className="table-th">Оценка</th>
              </tr>
            </thead>
            <tbody>
              {(rosterQ.data?.students || []).map(s => {
                const a = getAtt(s.id);
                return (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="table-td font-medium">{s.full_name}</td>
                    <td className="table-td">
                      <div className="flex gap-1">
                        {STATUS.map(st => {
                          const Icon = st.icon;
                          const active = a?.status === st.value;
                          return (
                            <button
                              key={st.value}
                              onClick={() => mark.mutate({ studentId: s.id, status: st.value, score: a?.score })}
                              className={`px-2 py-1 rounded-md border text-xs flex items-center gap-1 transition ${active ? st.tone : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                            >
                              <Icon size={12} /> {st.label}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="table-td">
                      <input
                        type="number" min={0} max={100}
                        className="input w-20"
                        defaultValue={a?.score ?? ''}
                        onBlur={e => {
                          const v = e.target.value ? Number(e.target.value) : null;
                          if (a) mark.mutate({ studentId: s.id, status: a.status, score: v });
                          else mark.mutate({ studentId: s.id, status: 'present', score: v });
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
              {(rosterQ.data?.students || []).length === 0 && (
                <tr><td colSpan={3} className="table-td text-center text-slate-500">В группе нет учеников</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
