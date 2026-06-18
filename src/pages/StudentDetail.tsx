import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { exportCSV } from '@/lib/csv';
import type { Student, StudentStatus } from '@/types/database';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import StatCard from '@/components/ui/StatCard';
import {
  ArrowLeft, Edit3, Trash2, GraduationCap, Wallet, TrendingUp, TrendingDown,
  ClipboardCheck, Phone, User, School, CalendarDays, Plus, Download, Target,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtDate, fmtDateTime, fmtMoney } from '@/lib/format';

const STATUS_LABELS: Record<StudentStatus, { label: string; tone: string }> = {
  active:    { label: 'Учится',     tone: 'badge-green' },
  frozen:    { label: 'Заморозка',  tone: 'badge-amber' },
  archived:  { label: 'Архив',      tone: 'badge-slate' },
  graduated: { label: 'Выпускник',  tone: 'badge-violet' },
};

const ATT_LABEL: Record<string, { label: string; tone: string }> = {
  present: { label: 'Был',      tone: 'badge-green' },
  absent:  { label: 'Нет',      tone: 'badge-red' },
  late:    { label: 'Опоздал',  tone: 'badge-amber' },
  excused: { label: 'Уваж.',    tone: 'badge-blue' },
};

const KIND_LABEL: Record<string, { label: string; tone: string }> = {
  income:  { label: 'Оплата',   tone: 'badge-green' },
  refund:  { label: 'Возврат',  tone: 'badge-slate' },
  payout:  { label: 'Выплата',  tone: 'badge-amber' },
  expense: { label: 'Расход',   tone: 'badge-red' },
};

export default function StudentDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Student> | null>(null);
  const [paying, setPaying] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['student-profile', id],
    queryFn: () => api.students.profile(id),
    enabled: !!id,
  });

  const updateStudent = useMutation({
    mutationFn: (s: Partial<Student>) => api.students.update(id, s),
    onSuccess: () => { toast.success('Сохранено'); setEditing(null); qc.invalidateQueries({ queryKey: ['student-profile', id] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: () => api.students.remove(id),
    onSuccess: () => { toast.success('Удалено'); navigate('/students'); },
    onError: (e: any) => toast.error(e.message),
  });

  const exportAttendance = () => {
    if (!data?.attendance.length) return;
    exportCSV(`attendance_${data.student.full_name}`, data.attendance, [
      { key: 'lesson_at', label: 'Дата', format: v => fmtDateTime(v) },
      { key: 'group_name', label: 'Группа' },
      { key: 'lesson_topic', label: 'Тема' },
      { key: 'status', label: 'Статус', format: v => ATT_LABEL[v]?.label || v },
      { key: 'score', label: 'Оценка' },
      { key: 'comment', label: 'Комментарий' },
    ]);
  };

  const exportPayments = () => {
    if (!data?.payments.length) return;
    exportCSV(`payments_${data.student.full_name}`, data.payments, [
      { key: 'paid_at', label: 'Дата', format: v => fmtDate(v) },
      { key: 'kind', label: 'Тип', format: v => KIND_LABEL[v]?.label || v },
      { key: 'amount', label: 'Сумма' },
      { key: 'currency', label: 'Валюта' },
      { key: 'method', label: 'Способ' },
      { key: 'description', label: 'Описание' },
    ]);
  };

  if (isLoading) return <div className="text-slate-500 p-6">Загрузка…</div>;
  if (!data) return <div className="text-slate-500 p-6">Ученик не найден</div>;

  const s = data.student;
  const balance = data.paid - data.monthlyCharge;

  return (
    <div>
      <Link to="/students" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600 mb-3">
        <ArrowLeft size={14} /> К списку учеников
      </Link>

      <PageHeader
        title={s.full_name}
        subtitle={`${s.grade ? s.grade + ' класс' : ''}${s.school ? ' · ' + s.school : ''}`}
        actions={
          <>
            <button className="btn-secondary" onClick={() => setEditing(s)}><Edit3 size={15} /> Редактировать</button>
            <button className="btn-secondary" onClick={() => setPaying(true)}><Plus size={15} /> Платёж</button>
            <button className="btn-danger" onClick={() => confirm(`Удалить «${s.full_name}»?`) && del.mutate()}><Trash2 size={15} /> Удалить</button>
          </>
        }
      />

      {/* contact info card */}
      <div className="card p-5 mb-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <Info label="Статус" value={<span className={STATUS_LABELS[s.status].tone}>{STATUS_LABELS[s.status].label}</span>} />
          <Info label="Телефон" icon={<Phone size={14} />} value={s.phone || '—'} />
          <Info label="Родитель" icon={<User size={14} />} value={s.parent_name || '—'} />
          <Info label="Тел. родителя" icon={<Phone size={14} />} value={s.parent_phone || '—'} />
          <Info label="Школа" icon={<School size={14} />} value={s.school || '—'} />
          <Info label="Цель ЕНТ" icon={<Target size={14} />} value={s.target_score ? `${s.target_score} баллов` : '—'} />
          <Info label="Зачислен" icon={<CalendarDays size={14} />} value={fmtDate(s.enrolled_at)} />
          <Info label="Создан" icon={<CalendarDays size={14} />} value={fmtDate(s.created_at)} />
        </div>
        {s.note && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Заметка</div>
            <div className="text-sm text-slate-700 whitespace-pre-wrap">{s.note}</div>
          </div>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Оплачено всего" value={fmtMoney(data.paid)}
          icon={<TrendingUp size={20} />} tone="emerald"
        />
        <StatCard
          label="К оплате/мес" value={fmtMoney(data.monthlyCharge)}
          hint={data.groups.length ? `по ${data.groups.length} группам` : 'нет групп'}
          icon={<Wallet size={20} />} tone="brand"
        />
        <StatCard
          label={balance >= 0 ? 'Баланс' : 'Долг'}
          value={fmtMoney(Math.abs(balance))}
          hint={balance >= 0 ? 'переплата' : 'к доплате'}
          icon={balance >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          tone={balance >= 0 ? 'emerald' : 'rose'}
        />
        <StatCard
          label="Посещаемость"
          value={data.attendancePct != null ? `${data.attendancePct}%` : '—'}
          hint={data.avgScore != null ? `средний балл: ${data.avgScore}` : 'нет оценок'}
          icon={<ClipboardCheck size={20} />} tone="amber"
        />
      </div>

      {/* Groups */}
      <div className="card mb-6">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold"><GraduationCap size={18} /> Группы ({data.groups.length})</div>
        </div>
        {data.groups.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">Ученик не записан ни в одну группу.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.groups.map(g => (
              <div key={g.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-900">{g.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    <span style={{ color: g.subject_color || '#6366f1' }}>●</span> {g.subject_name || 'Без предмета'}
                    {g.teacher_name ? ` · ${g.teacher_name}` : ''}
                  </div>
                </div>
                <div className="text-sm font-semibold">{fmtMoney(Number(g.monthly_fee))}/мес</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Attendance */}
      <div className="card mb-6">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold"><ClipboardCheck size={18} /> Посещаемость ({data.attendance.length})</div>
          <button className="btn-ghost" onClick={exportAttendance} disabled={!data.attendance.length}><Download size={14} /> CSV</button>
        </div>
        {data.attendance.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">Пока нет отметок о посещаемости.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="table-th">Дата</th>
                  <th className="table-th">Группа</th>
                  <th className="table-th">Тема</th>
                  <th className="table-th">Статус</th>
                  <th className="table-th">Оценка</th>
                </tr>
              </thead>
              <tbody>
                {data.attendance.slice(0, 30).map(a => (
                  <tr key={a.lesson_id} className="hover:bg-slate-50">
                    <td className="table-td">{fmtDateTime(a.lesson_at)}</td>
                    <td className="table-td">{a.group_name}</td>
                    <td className="table-td text-slate-600">{a.lesson_topic || '—'}</td>
                    <td className="table-td"><span className={ATT_LABEL[a.status]?.tone}>{ATT_LABEL[a.status]?.label}</span></td>
                    <td className="table-td font-semibold">{a.score ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payments */}
      <div className="card">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold"><Wallet size={18} /> Платежи ({data.payments.length})</div>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={exportPayments} disabled={!data.payments.length}><Download size={14} /> CSV</button>
            <button className="btn-primary" onClick={() => setPaying(true)}><Plus size={14} /> Платёж</button>
          </div>
        </div>
        {data.payments.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">Нет транзакций по этому ученику.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="table-th">Дата</th>
                  <th className="table-th">Тип</th>
                  <th className="table-th">Сумма</th>
                  <th className="table-th">Способ</th>
                  <th className="table-th">Описание</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="table-td">{fmtDate(p.paid_at)}</td>
                    <td className="table-td"><span className={KIND_LABEL[p.kind]?.tone}>{KIND_LABEL[p.kind]?.label}</span></td>
                    <td className="table-td font-semibold">{fmtMoney(Number(p.amount), p.currency)}</td>
                    <td className="table-td">{p.method || '—'}</td>
                    <td className="table-td">{p.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <StudentEditModal
          value={editing}
          saving={updateStudent.isPending}
          onClose={() => setEditing(null)}
          onSave={v => updateStudent.mutate(v)}
        />
      )}
      {paying && (
        <QuickPaymentModal
          studentId={id}
          monthlyCharge={data.monthlyCharge}
          onClose={() => setPaying(false)}
          onSaved={() => { setPaying(false); qc.invalidateQueries({ queryKey: ['student-profile', id] }); }}
        />
      )}
    </div>
  );
}

function Info({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
        {icon} {label}
      </div>
      <div className="text-sm text-slate-900 mt-1 font-medium">{value}</div>
    </div>
  );
}

function StudentEditModal({ value, saving, onClose, onSave }: {
  value: Partial<Student>; saving: boolean; onClose: () => void; onSave: (v: Partial<Student>) => void;
}) {
  const [form, setForm] = useState<Partial<Student>>(value);
  return (
    <Modal open onClose={onClose} title="Редактировать ученика" size="lg"
      footer={<>
        <button className="btn-secondary" onClick={onClose}>Отмена</button>
        <button className="btn-primary" disabled={saving} onClick={() => onSave(form)}>{saving ? 'Сохраняем…' : 'Сохранить'}</button>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className="label">ФИО *</label><input className="input" value={form.full_name||''} onChange={e=>setForm({...form, full_name: e.target.value})} /></div>
        <div><label className="label">Телефон</label><input className="input" value={form.phone||''} onChange={e=>setForm({...form, phone: e.target.value})} /></div>
        <div><label className="label">Класс</label><input type="number" className="input" value={form.grade ?? ''} onChange={e=>setForm({...form, grade: e.target.value ? Number(e.target.value) : null})} /></div>
        <div><label className="label">Родитель</label><input className="input" value={form.parent_name||''} onChange={e=>setForm({...form, parent_name: e.target.value})} /></div>
        <div><label className="label">Тел. родителя</label><input className="input" value={form.parent_phone||''} onChange={e=>setForm({...form, parent_phone: e.target.value})} /></div>
        <div><label className="label">Школа</label><input className="input" value={form.school||''} onChange={e=>setForm({...form, school: e.target.value})} /></div>
        <div><label className="label">Цель по ЕНТ</label><input type="number" className="input" value={form.target_score ?? ''} onChange={e=>setForm({...form, target_score: e.target.value ? Number(e.target.value) : null})} /></div>
        <div>
          <label className="label">Статус</label>
          <select className="input" value={form.status||'active'} onChange={e=>setForm({...form, status: e.target.value as StudentStatus})}>
            {Object.entries(STATUS_LABELS).map(([v,{label}]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </div>
        <div className="col-span-2"><label className="label">Заметка</label><textarea className="input" rows={3} value={form.note||''} onChange={e=>setForm({...form, note: e.target.value})} /></div>
      </div>
    </Modal>
  );
}

function QuickPaymentModal({ studentId, monthlyCharge, onClose, onSaved }: {
  studentId: string; monthlyCharge: number; onClose: () => void; onSaved: () => void;
}) {
  const [amount, setAmount] = useState(monthlyCharge || 30000);
  const [method, setMethod] = useState('Каспи');
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('Оплата за обучение');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.payments.create({
        kind: 'income', amount, currency: 'KZT',
        student_id: studentId, method, paid_at: paidAt, description,
      });
      toast.success('Платёж создан');
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Добавить платёж от ученика"
      footer={<>
        <button className="btn-secondary" onClick={onClose}>Отмена</button>
        <button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Сохраняем…' : 'Создать платёж'}</button>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Сумма, ₸</label><input type="number" className="input" value={amount} onChange={e => setAmount(Number(e.target.value))} /></div>
        <div><label className="label">Дата</label><input type="date" className="input" value={paidAt} onChange={e => setPaidAt(e.target.value)} /></div>
        <div className="col-span-2"><label className="label">Способ оплаты</label><input className="input" value={method} onChange={e => setMethod(e.target.value)} /></div>
        <div className="col-span-2"><label className="label">Описание</label><input className="input" value={description} onChange={e => setDescription(e.target.value)} /></div>
      </div>
    </Modal>
  );
}
