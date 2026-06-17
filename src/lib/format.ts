export const fmtMoney = (n: number | null | undefined, currency = 'KZT') => {
  if (n == null) return '—';
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
};

export const fmtDate = (s: string | null | undefined) => {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const fmtDateTime = (s: string | null | undefined) => {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const fmtPhone = (s: string | null | undefined) => s || '—';
