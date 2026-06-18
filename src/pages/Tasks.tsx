import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Task, TaskKind, TaskStatus, TaskPriority, Profile } from '@/types/database';
import { useAuth } from '@/stores/auth';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { Plus, ClipboardList, Target, Edit3, Trash2, CheckCircle2, Circle, Clock, Flag, Download, AlertTriangle, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtDateTime, fmtDate } from '@/lib/format';
import { exportCSV } from '@/lib/csv';
import { isBefore, isToday, parseISO, format } from 'date-fns';
import { ru } from 'date-fns/locale';
import clsx from 'clsx';

const PRIORITY: Record<TaskPriority, { label: string; tone: string }> = {
  low:    { label: 'Низкий',    tone: 'badge-slate' },
  normal: { label: 'Обычный',   tone: 'badge-blue' },
  high:   { label: 'Высокий',   tone: 'badge-amber' },
  urgent: { label: 'Срочный',   tone: 'badge-red' },
};

const STATUS: Record<TaskStatus, { label: string; tone: string }> = {
  open:        { label: 'Открыто',    tone: 'badge-blue' },
  in_progress: { label: 'В работе',   tone: 'badge-violet' },
  done:        { label: 'Сделано',    tone: 'badge-green' },
  canceled:    { label: 'Отменено',   tone: 'badge-slate' },
};

const emptyTask: Partial<Task> = { title: '', kind: 'task', status: 'open', priority: 'normal' };

export default function TasksPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [kind, setKind] = useState<TaskKind>('task');
  const [filter, setFilter] = useState<'mine' | 'all' | 'today' | 'overdue'>('mine');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'open_only' | 'all'>('open_only');
  const [editing, setEditing] = useState<Partial<Task> | null>(null);

  const tasksQ = useQuery({ queryKey: ['tasks'], queryFn: () => api.tasks.list({ orderBy: 'due_at', order: 'asc', limit: 1000 }) });
  const usersQ = useQuery({ queryKey: ['users-list'], queryFn: () => api.users.list() });

  const userById = useMemo(() => {
    const m = new Map<string, Profile>();
    (usersQ.data || []).forEach(u => m.set(u.id, u));
    return m;
  }, [usersQ.data]);

  const filtered = useMemo(() => {
    let list = (tasksQ.data || []).filter(t => t.kind === kind);
    if (filter === 'mine') list = list.filter(t => t.assigned_to === user?.id);
    else if (filter === 'today') list = list.filter(t => t.due_at && isToday(parseISO(t.due_at)));
    else if (filter === 'overdue') list = list.filter(t => t.due_at && isBefore(parseISO(t.due_at), new Date()) && t.status !== 'done' && t.status !== 'canceled');
    if (statusFilter === 'open_only') list = list.filter(t => t.status === 'open' || t.status === 'in_progress');
    else if (statusFilter !== 'all') list = list.filter(t => t.status === statusFilter);
    return list;
  }, [tasksQ.data, kind, filter, statusFilter, user?.id]);

  const save = useMutation({
    mutationFn: (t: Partial<Task>) => {
      const payload: Partial<Task> = {
        ...t,
        due_at: t.due_at ? new Date(t.due_at).toISOString() : null,
      };
      return t.id ? api.tasks.update(t.id, payload) : api.tasks.create(payload);
    },
    onSuccess: () => { toast.success('Сохранено'); setEditing(null); qc.invalidateQueries({ queryKey: ['tasks'] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleDone = useMutation({
    mutationFn: (t: Task) => api.tasks.update(t.id, { status: t.status === 'done' ? 'open' : 'done' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.tasks.remove(id),
    onSuccess: () => { toast.success('Удалено'); qc.invalidateQueries({ queryKey: ['tasks'] }); },
  });

  const onExport = () => {
    if (!filtered.length) return;
    exportCSV(kind === 'plan' ? 'plans' : 'tasks', filtered, [
      { key: 'title', label: 'Название' },
      { key: 'kind', label: 'Тип', format: v => v === 'plan' ? 'План' : 'Задача' },
      { key: 'status', label: 'Статус', format: v => STATUS[v as TaskStatus]?.label || v },
      { key: 'priority', label: 'Приоритет', format: v => PRIORITY[v as TaskPriority]?.label || v },
      { key: 'due_at', label: 'Дедлайн', format: v => v ? fmtDateTime(v) : '' },
      { key: 'assigned_to', label: 'Ответственный', format: v => v ? (userById.get(v as string)?.full_name || '') : '' },
      { key: 'description', label: 'Описание' },
      { key: 'created_at', label: 'Создано', format: v => fmtDate(v) },
    ]);
  };

  const today = (tasksQ.data || []).filter(t => t.kind === 'task' && t.due_at && isToday(parseISO(t.due_at)) && t.status !== 'done').length;
  const overdue = (tasksQ.data || []).filter(t => t.kind === 'task' && t.due_at && isBefore(parseISO(t.due_at), new Date()) && t.status !== 'done' && t.status !== 'canceled').length;

  return (
    <div>
      <PageHeader
        title="Задачи и планы"
        subtitle="Личный таск-менеджер для сотрудников"
        actions={
          <>
            <button className="btn-secondary" onClick={onExport} disabled={!filtered.length}><Download size={15} /> CSV</button>
            <button className="btn-primary" onClick={() => setEditing({ ...emptyTask, kind })}>
              <Plus size={16} /> {kind === 'plan' ? 'Новый план' : 'Новая задача'}
            </button>
          </>
        }
      />

      {/* Tabs */}
      <div className="card p-1 inline-flex mb-4">
        <button
          onClick={() => setKind('task')}
          className={clsx(
            'px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition',
            kind === 'task' ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50',
          )}
        ><ClipboardList size={16} /> Задачи</button>
        <button
          onClick={() => setKind('plan')}
          className={clsx(
            'px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition',
            kind === 'plan' ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50',
          )}
        ><Target size={16} /> Планы и цели</button>
      </div>

      {/* Filters */}
      <div className="card p-3 mb-4 flex flex-wrap items-center gap-2">
        {(['mine','all','today','overdue'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={clsx(
              'px-3 py-1.5 text-sm font-medium rounded-md border transition',
              filter === f ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50',
            )}
          >
            {f === 'mine' ? 'Мои' : f === 'all' ? 'Все' : f === 'today' ? 'На сегодня' : 'Просрочено'}
            {f === 'today' && today > 0 && <span className="ml-1.5 bg-amber-100 text-amber-800 rounded-full px-1.5 text-[10px]">{today}</span>}
            {f === 'overdue' && overdue > 0 && <span className="ml-1.5 bg-rose-100 text-rose-800 rounded-full px-1.5 text-[10px]">{overdue}</span>}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <select className="input py-1.5 w-48" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
            <option value="open_only">Активные</option>
            <option value="all">Все статусы</option>
            <option value="open">Открыто</option>
            <option value="in_progress">В работе</option>
            <option value="done">Сделано</option>
            <option value="canceled">Отменено</option>
          </select>
        </div>
      </div>

      {tasksQ.isLoading ? (
        <div className="text-slate-500">Загрузка…</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={kind === 'plan' ? <Target size={24} /> : <ClipboardList size={24} />}
          title={kind === 'plan' ? 'Планов пока нет' : 'Задач пока нет'}
          hint={kind === 'plan' ? 'Поставьте цель на месяц/квартал, чтобы команда понимала направление.' : 'Создайте первую задачу.'}
          action={<button className="btn-primary" onClick={() => setEditing({ ...emptyTask, kind })}><Plus size={16} /> Создать</button>}
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map(t => {
            const done = t.status === 'done';
            const overdueRow = !!t.due_at && isBefore(parseISO(t.due_at), new Date()) && !done && t.status !== 'canceled';
            const assignee = t.assigned_to ? userById.get(t.assigned_to) : null;
            return (
              <div
                key={t.id}
                className={clsx(
                  'card p-4 flex items-start gap-3 hover:shadow-md transition',
                  done && 'opacity-60',
                  overdueRow && 'border-rose-200 bg-rose-50/30',
                )}
              >
                <button onClick={() => toggleDone.mutate(t)} className="mt-1 flex-shrink-0">
                  {done
                    ? <CheckCircle2 size={20} className="text-emerald-600" />
                    : <Circle size={20} className="text-slate-300 hover:text-brand-500" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className={clsx('font-semibold text-slate-900', done && 'line-through')}>{t.title}</div>
                      {t.description && <div className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{t.description}</div>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => setEditing({ ...t, due_at: t.due_at ? t.due_at.slice(0,16) : null })} className="btn-ghost p-1.5"><Edit3 size={15} /></button>
                      <button onClick={() => confirm('Удалить?') && del.mutate(t.id)} className="btn-ghost p-1.5 text-rose-600"><Trash2 size={15} /></button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-2 text-xs">
                    <span className={STATUS[t.status].tone}>{STATUS[t.status].label}</span>
                    <span className={PRIORITY[t.priority].tone}><Flag size={10} className="inline mr-0.5" />{PRIORITY[t.priority].label}</span>
                    {t.due_at && (
                      <span className={clsx(
                        'inline-flex items-center gap-1',
                        overdueRow ? 'text-rose-700 font-semibold' : 'text-slate-500',
                      )}>
                        <Clock size={12} />
                        {format(parseISO(t.due_at), kind === 'plan' ? 'd MMM yyyy' : 'd MMM, HH:mm', { locale: ru })}
                        {overdueRow && <AlertTriangle size={12} />}
                      </span>
                    )}
                    {assignee && (
                      <span className="text-slate-500">→ {assignee.full_name}</span>
                    )}
                    {t.kind === 'plan' && <Sparkles size={12} className="text-violet-500" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <TaskModal
          value={editing}
          users={usersQ.data || []}
          onClose={() => setEditing(null)}
          onSave={t => save.mutate(t)}
          saving={save.isPending}
        />
      )}
    </div>
  );
}

function TaskModal({ value, users, onClose, onSave, saving }: {
  value: Partial<Task>; users: Profile[]; onClose: () => void; onSave: (t: Partial<Task>) => void; saving: boolean;
}) {
  const [form, setForm] = useState<Partial<Task>>(value);
  const isPlan = form.kind === 'plan';
  return (
    <Modal open onClose={onClose}
      title={value.id ? 'Редактировать' : (isPlan ? 'Новый план' : 'Новая задача')}
      footer={<>
        <button className="btn-secondary" onClick={onClose}>Отмена</button>
        <button className="btn-primary" disabled={saving || !form.title} onClick={() => onSave(form)}>{saving ? 'Сохраняем…' : 'Сохранить'}</button>
      </>}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className="label">{isPlan ? 'Цель / задача' : 'Название'} *</label><input className="input" value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} placeholder={isPlan ? 'Например: 5 новых учеников до конца месяца' : 'Позвонить родителю Алии'} /></div>
        <div className="col-span-2"><label className="label">Описание</label><textarea className="input" rows={3} value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
        <div>
          <label className="label">Тип</label>
          <select className="input" value={form.kind || 'task'} onChange={e => setForm({ ...form, kind: e.target.value as TaskKind })}>
            <option value="task">Задача</option>
            <option value="plan">План / цель</option>
          </select>
        </div>
        <div>
          <label className="label">{isPlan ? 'Срок плана' : 'Дедлайн'}</label>
          <input type={isPlan ? 'date' : 'datetime-local'} className="input" value={form.due_at || ''} onChange={e => setForm({ ...form, due_at: e.target.value })} />
        </div>
        <div>
          <label className="label">Приоритет</label>
          <select className="input" value={form.priority || 'normal'} onChange={e => setForm({ ...form, priority: e.target.value as TaskPriority })}>
            {Object.entries(PRIORITY).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Статус</label>
          <select className="input" value={form.status || 'open'} onChange={e => setForm({ ...form, status: e.target.value as TaskStatus })}>
            {Object.entries(STATUS).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="label">Ответственный</label>
          <select className="input" value={form.assigned_to || ''} onChange={e => setForm({ ...form, assigned_to: e.target.value || null })}>
            <option value="">Без ответственного</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
          </select>
        </div>
      </div>
    </Modal>
  );
}
