import { ReactNode } from 'react';

export default function EmptyState({ icon, title, hint, action }: {
  icon?: ReactNode; title: string; hint?: string; action?: ReactNode;
}) {
  return (
    <div className="text-center py-16 px-6">
      {icon && <div className="mx-auto w-14 h-14 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center mb-4">{icon}</div>}
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {hint && <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
