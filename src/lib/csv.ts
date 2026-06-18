export interface CSVColumn<T> {
  key: keyof T | string;
  label: string;
  format?: (v: any, row: T) => string | number | null | undefined;
}

const esc = (v: any) => {
  if (v == null) return '';
  const s = typeof v === 'string' ? v : String(v);
  const cleaned = s.replace(/"/g, '""');
  return /[,"\n;]/.test(cleaned) ? `"${cleaned}"` : cleaned;
};

export function exportCSV<T extends Record<string, any>>(
  filename: string,
  rows: T[],
  columns: CSVColumn<T>[],
) {
  const header = columns.map(c => esc(c.label)).join(',');
  const body = rows
    .map(r => columns.map(c => {
      const raw = (r as any)[c.key as string];
      const val = c.format ? c.format(raw, r) : raw;
      return esc(val);
    }).join(','))
    .join('\n');

  // BOM so Excel opens UTF-8 correctly
  const csv = '﻿' + header + '\n' + body;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = filename.includes('.csv') ? filename : `${filename}_${date}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
