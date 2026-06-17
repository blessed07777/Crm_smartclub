import { ReactNode } from 'react';
import clsx from 'clsx';

export default function StatCard({ label, value, hint, icon, tone = 'brand' }: {
  label: string; value: ReactNode; hint?: string; icon?: ReactNode;
  tone?: 'brand' | 'emerald' | 'amber' | 'rose' | 'slate';
}) {
  const tones = {
    brand:   'bg-brand-50 text-brand-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber:   'bg-amber-50 text-amber-700',
    rose:    'bg-rose-50 text-rose-700',
    slate:   'bg-slate-100 text-slate-700',
  } as const;
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase font-semibold text-slate-500 tracking-wider">{label}</div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{value}</div>
          {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
        </div>
        {icon && <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center', tones[tone])}>{icon}</div>}
      </div>
    </div>
  );
}
