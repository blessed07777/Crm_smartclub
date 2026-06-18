import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AttendanceStatus, Lesson } from '@/types/database';
import Modal from '@/components/ui/Modal';
import { Check, X, Clock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtDateTime } from '@/lib/format';

const STATUS: { value: AttendanceStatus; label: string; icon: any; tone: string }[] = [
  { value: 'present', label: 'Был',     icon: Check,       tone: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  { value: 'absent',  label: 'Нет',     icon: X,           tone: 'bg-rose-100 text-rose-700 border-rose-300' },
  { value: 'late',    label: 'Опоздал', icon: Clock,       tone: 'bg-amber-100 text-amber-700 border-amber-300' },
  { value: 'excused', label: 'Уваж.',   icon: AlertCircle, tone: 'bg-blue-100 text-blue-700 border-blue-300' },
];

export default function AttendanceModal({
  lesson, onClose,
}: { lesson: Lesson; onClose: () => void }) {
  const qc = useQueryClient();

  const rosterQ = useQuery({
    queryKey: ['lesson-roster', lesson.id],
    queryFn: () => api.lessons.rosterWithAttendance(lesson.id),
  });

  const mark = useMutation({
    mutationFn: ({ studentId, status, score }: { studentId: string; status: AttendanceStatus; score?: number | null }) =>
      api.lessons.markAttendance(lesson.id, { student_id: studentId, status, score: score ?? null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lesson-roster', lesson.id] }),
    onError: (e: any) => toast.error(e.message),
  });

  const getAtt = (sid: string) => rosterQ.data?.attendance.find(a => a.student_id === sid);

  return (
    <Modal
      open onClose={onClose}
      title={`Посещаемость · ${lesson.topic || 'Урок'}`}
      size="xl"
    >
      <div className="text-xs text-slate-500 mb-3">{fmtDateTime(lesson.starts_at)}</div>
      {rosterQ.isLoading ? (
        <div className="text-slate-500">Загрузка…</div>
      ) : (rosterQ.data?.students || []).length === 0 ? (
        <div className="text-sm text-slate-500 py-8 text-center">В группе нет учеников</div>
      ) : (
        <div className="overflow-x-auto -mx-5">
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
                      <div className="flex gap-1 flex-wrap">
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
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
