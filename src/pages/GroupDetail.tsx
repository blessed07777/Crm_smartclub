import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Lesson } from '@/types/database';
import { useAuth } from '@/stores/auth';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Modal from '@/components/ui/Modal';
import AttendanceModal from '@/components/ui/AttendanceModal';
import EmptyState from '@/components/ui/EmptyState';
import {
  ArrowLeft, Users, CalendarDays, Wallet, ClipboardCheck, Edit3, Trash2,
  Plus, GraduationCap, UserPlus, ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtMoney, fmtDate, fmtDateTime } from '@/lib/format';
import { format, parseISO, isBefore } from 'date-fns';
import { ru } from 'date-fns/locale';
import clsx from 'clsx';

function localDT(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function GroupDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isStaff = user?.role === 'admin' || user?.role === 'manager';

  const [lessonModal, setLessonModal] = useState<Partial<Lesson> | null>(null);
  const [attendanceFor, setAttendanceFor] = useState<Lesson | null>(null);
  const [addingStudent, setAddingStudent] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['group-profile', id],
    queryFn: () => api.groups.profile(id),
    enabled: !!id,
  });

  const allStudentsQ = useQuery({
    queryKey: ['students-all-for-roster'],
    queryFn: () => api.students.list({ limit: 2000, orderBy: 'full_name', order: 'asc' }),
    enabled: addingStudent,
  });

  const saveLesson = useMutation({
    mutationFn: (l: Partial<Lesson>) => {
      const payload = {
        ...l,
        starts_at: l.starts_at ? new Date(l.starts_at).toISOString() : undefined,
        ends_at:   l.ends_at   ? new Date(l.ends_at).toISOString()   : undefined,
      };
      return l.id ? api.lessons.update(l.id, payload) : api.lessons.create(payload);
    },
    onSuccess: () => { toast.success('Сохранено'); setLessonModal(null); qc.invalidateQueries({ queryKey: ['group-profile', id] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const delLesson = useMutation({
    mutationFn: (lid: string) => api.lessons.remove(lid),
    onSuccess: () => { toast.success('Урок удалён'); setLessonModal(null); qc.invalidateQueries({ queryKey: ['group-profile', id] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const enroll = useMutation({
    mutationFn: (sid: string) => api.groups.addStudent(id, sid),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['group-profile', id] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const unenroll = useMutation({
    mutationFn: (sid: string) => api.groups.removeStudent(id, sid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['group-profile', id] }),
    onError: (e: any) => toast.error(e.message),
  });

  const removeGroup = useMutation({
    mutationFn: () => api.groups.remove(id),
    onSuccess: () => { toast.success('Группа удалена'); navigate('/groups'); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-slate-500 p-6">Загрузка…</div>;
  if (!data) return <div className="text-slate-500 p-6">Группа не найдена</div>;

  const g = data.group;
  const inGroup = new Set(data.students.map(s => s.id));

  const planLesson = (date = new Date()) => {
    const start = new Date(date); start.setHours(start.getHours() + 1, 0, 0, 0);
    const end   = new Date(start); end.setMinutes(end.getMinutes() + 90);
    setLessonModal({
      group_id: id,
      starts_at: localDT(start),
      ends_at: localDT(end),
      topic: '', homework: '', is_canceled: false,
    });
  };

  return (
    <div>
      <Link to="/groups" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600 mb-3">
        <ArrowLeft size={14} /> К списку групп
      </Link>

      <PageHeader
        title={g.name}
        subtitle={[
          g.subject_name,
          g.teacher_name ? `преподаватель: ${g.teacher_name}` : null,
          g.schedule_summary,
        ].filter(Boolean).join(' · ')}
        actions={isStaff && (
          <>
            <button className="btn-secondary" onClick={() => planLesson()}><Plus size={15} /> Запланировать урок</button>
            <button className="btn-secondary" onClick={() => setAddingStudent(true)}><UserPlus size={15} /> Добавить ученика</button>
            <button className="btn-danger" onClick={() => confirm(`Удалить группу «${g.name}»?`) && removeGroup.mutate()}><Trash2 size={15} /> Удалить</button>
          </>
        )}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Учеников" value={data.students.length} hint={`из ${g.capacity || '—'} мест`} icon={<Users size={20} />} tone="brand" />
        <StatCard label="Уроков"  value={data.stats.pastLessons + data.stats.upcomingLessons} hint={`${data.stats.upcomingLessons} впереди`} icon={<CalendarDays size={20} />} tone="amber" />
        <StatCard label="Ожидаемая выручка" value={fmtMoney(data.stats.monthlyExpected)} hint={`${fmtMoney(Number(g.monthly_fee))} × ${data.students.length}`} icon={<Wallet size={20} />} tone="emerald" />
        <StatCard label="Посещаемость 90 дн." value={data.stats.attendancePct != null ? `${data.stats.attendancePct}%` : '—'} icon={<ClipboardCheck size={20} />} tone="rose" />
      </div>

      {/* Group meta */}
      <div className="card p-5 mb-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <Info label="Предмет" value={
            <span><span style={{ color: g.subject_color || '#6366f1' }}>●</span> {g.subject_name || '—'}</span>
          } />
          <Info label="Преподаватель" value={
            g.teacher_id
              ? <Link to={`/teachers/${g.teacher_id}`} className="text-brand-700 hover:underline inline-flex items-center gap-1">
                  {g.teacher_name} <ExternalLink size={11} />
                </Link>
              : '—'
          } />
          <Info label="Стоимость/мес" value={fmtMoney(Number(g.monthly_fee))} />
          <Info label="Вместимость" value={g.capacity ?? '—'} />
          <Info label="Расписание" value={g.schedule_summary || '—'} />
          <Info label="Начало" value={g.starts_on ? fmtDate(g.starts_on) : '—'} />
          <Info label="Конец" value={g.ends_on ? fmtDate(g.ends_on) : '—'} />
          <Info label="Статус" value={
            <span className={g.is_active ? 'badge-green' : 'badge-slate'}>{g.is_active ? 'Активна' : 'Неактивна'}</span>
          } />
        </div>
      </div>

      {/* Roster */}
      <div className="card mb-6">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold"><Users size={18} /> Состав группы ({data.students.length})</div>
          {isStaff && (
            <button className="btn-ghost text-brand-700" onClick={() => setAddingStudent(true)}>
              <UserPlus size={14} /> Добавить
            </button>
          )}
        </div>
        {data.students.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">В группе пока никого. {isStaff && 'Добавьте учеников через кнопку выше.'}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="table-th">ФИО</th>
                  <th className="table-th">Класс</th>
                  <th className="table-th">Школа</th>
                  <th className="table-th">Телефон</th>
                  <th className="table-th">Добавлен</th>
                  <th className="table-th"></th>
                </tr>
              </thead>
              <tbody>
                {data.students.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="table-td">
                      <Link to={`/students/${s.id}`} className="text-brand-700 font-medium hover:underline inline-flex items-center gap-1">
                        {s.full_name} <ExternalLink size={11} className="text-slate-400" />
                      </Link>
                    </td>
                    <td className="table-td">{s.grade ?? '—'}</td>
                    <td className="table-td">{s.school || '—'}</td>
                    <td className="table-td">{s.phone || s.parent_phone || '—'}</td>
                    <td className="table-td">{fmtDate(s.joined_at)}</td>
                    <td className="table-td text-right">
                      {isStaff && (
                        <button onClick={() => confirm(`Убрать «${s.full_name}» из группы?`) && unenroll.mutate(s.id)}
                          className="btn-ghost p-1.5 text-rose-600" title="Убрать из группы">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lessons */}
      <div className="card mb-6">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold"><CalendarDays size={18} /> Уроки ({data.lessons.length})</div>
          {isStaff && (
            <button className="btn-ghost text-brand-700" onClick={() => planLesson()}>
              <Plus size={14} /> Запланировать
            </button>
          )}
        </div>
        {data.lessons.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">Ещё не было уроков.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.lessons.slice(0, 30).map(l => {
              const past = isBefore(parseISO(l.ends_at), new Date());
              return (
                <div key={l.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={clsx(
                      'w-14 h-14 rounded-lg flex flex-col items-center justify-center text-[10px] font-bold flex-shrink-0',
                      past ? 'bg-slate-100 text-slate-500' : 'bg-brand-50 text-brand-700',
                      l.is_canceled && 'opacity-40 line-through',
                    )}>
                      <span>{format(parseISO(l.starts_at), 'd MMM', { locale: ru })}</span>
                      <span className="text-[11px] font-mono">{format(parseISO(l.starts_at), 'HH:mm')}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900">{l.topic || 'Без темы'}</div>
                      <div className="text-xs text-slate-500">{fmtDateTime(l.starts_at)} — {format(parseISO(l.ends_at), 'HH:mm')}{l.is_canceled && ' · отменён'}</div>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => setAttendanceFor(l)} className="btn-secondary"><ClipboardCheck size={14} /> Посещаемость</button>
                    {isStaff && (
                      <>
                        <button onClick={() => setLessonModal({ ...l, starts_at: l.starts_at.slice(0,16), ends_at: l.ends_at.slice(0,16) })} className="btn-ghost p-1.5"><Edit3 size={15} /></button>
                        <button onClick={() => confirm('Удалить урок?') && delLesson.mutate(l.id)} className="btn-ghost p-1.5 text-rose-600"><Trash2 size={15} /></button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payments */}
      <div className="card">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold"><Wallet size={18} /> Платежи по группе ({data.payments.length})</div>
        </div>
        {data.payments.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">Платежей пока нет.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="table-th">Дата</th>
                  <th className="table-th">Ученик</th>
                  <th className="table-th">Тип</th>
                  <th className="table-th">Сумма</th>
                  <th className="table-th">Описание</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="table-td">{fmtDate(p.paid_at)}</td>
                    <td className="table-td">
                      {p.student_id
                        ? <Link to={`/students/${p.student_id}`} className="text-brand-700 hover:underline">{p.student_name || '—'}</Link>
                        : '—'}
                    </td>
                    <td className="table-td capitalize">{p.kind === 'income' ? 'Оплата' : p.kind}</td>
                    <td className="table-td font-semibold">{fmtMoney(Number(p.amount), p.currency)}</td>
                    <td className="table-td">{p.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {lessonModal && (
        <Modal open onClose={() => setLessonModal(null)}
          title={lessonModal.id ? 'Редактировать урок' : 'Новый урок'}
          footer={<>
            {lessonModal.id && (
              <button className="btn-danger mr-auto" onClick={() => confirm('Удалить?') && delLesson.mutate(lessonModal.id!)}>
                Удалить
              </button>
            )}
            <button className="btn-secondary" onClick={() => setLessonModal(null)}>Отмена</button>
            <button className="btn-primary" disabled={saveLesson.isPending} onClick={() => saveLesson.mutate(lessonModal)}>Сохранить</button>
          </>}
        >
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Начало *</label><input type="datetime-local" className="input" value={lessonModal.starts_at || ''} onChange={e => setLessonModal({...lessonModal, starts_at: e.target.value})} /></div>
            <div><label className="label">Окончание *</label><input type="datetime-local" className="input" value={lessonModal.ends_at || ''} onChange={e => setLessonModal({...lessonModal, ends_at: e.target.value})} /></div>
            <div className="col-span-2"><label className="label">Тема</label><input className="input" value={lessonModal.topic || ''} onChange={e => setLessonModal({...lessonModal, topic: e.target.value})} /></div>
            <div className="col-span-2"><label className="label">Домашнее задание</label><textarea className="input" rows={2} value={lessonModal.homework || ''} onChange={e => setLessonModal({...lessonModal, homework: e.target.value})} /></div>
            <div className="col-span-2"><label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={!!lessonModal.is_canceled} onChange={e => setLessonModal({...lessonModal, is_canceled: e.target.checked})} /> Урок отменён</label></div>
          </div>
        </Modal>
      )}

      {addingStudent && (
        <Modal open onClose={() => setAddingStudent(false)} title="Добавить ученика в группу" size="lg">
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {(allStudentsQ.data || []).filter(s => !inGroup.has(s.id)).map(s => (
              <button key={s.id}
                onClick={() => enroll.mutate(s.id)}
                className="w-full flex items-center justify-between bg-white border border-slate-200 hover:bg-brand-50 rounded-lg p-3 text-sm">
                <div className="text-left">
                  <div className="font-medium text-slate-900">{s.full_name}</div>
                  <div className="text-xs text-slate-500">{s.grade ? `${s.grade} класс · ` : ''}{s.school || ''}</div>
                </div>
                <Plus size={14} />
              </button>
            ))}
            {(allStudentsQ.data || []).filter(s => !inGroup.has(s.id)).length === 0 && (
              <div className="text-sm text-slate-400 text-center py-8">Все ученики уже в группе.</div>
            )}
          </div>
        </Modal>
      )}

      {attendanceFor && (
        <AttendanceModal lesson={attendanceFor} onClose={() => setAttendanceFor(null)} />
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</div>
      <div className="text-sm text-slate-900 mt-1 font-medium">{value}</div>
    </div>
  );
}
