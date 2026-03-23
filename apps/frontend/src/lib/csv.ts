export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][][]): void;
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void;
export function downloadCsv(filename: string, headers: string[], rows: unknown[][]): void {
  const escape = (v: unknown) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [headers, ...rows].map(r => (r as unknown[]).map(escape).join(','));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
