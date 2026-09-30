import { config } from '../config.js';

const pad = (n: number) => String(n).padStart(2, '0');

/** Data (YYYY-MM-DD) e hora (HH:MM) atuais no fuso configurado. */
export function nowParts(d = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: config.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  const hour = p.hour === '24' ? '00' : p.hour;
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${hour}:${p.minute}` };
}
export const today = () => nowParts().date;

export function parseDate(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
export function fmtDate(d: Date) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
export function addDays(s: string, n: number) {
  const d = parseDate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return fmtDate(d);
}
/** Segunda-feira da semana da data. */
export function startOfWeek(s: string) {
  const d = parseDate(s);
  const dow = (d.getUTCDay() + 6) % 7;
  return addDays(s, -dow);
}
export const endOfWeek = (s: string) => addDays(startOfWeek(s), 6);
export function startOfMonth(s: string) { return `${s.slice(0, 7)}-01`; }
export function endOfMonth(s: string) {
  const d = parseDate(startOfMonth(s));
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  return fmtDate(d);
}
export function addMonths(s: string, n: number) {
  const d = parseDate(startOfMonth(s));
  d.setUTCMonth(d.getUTCMonth() + n, 1);
  return fmtDate(d);
}
export function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
export function minutesToTime(min: number) {
  const m = Math.min(min, 23 * 60 + 59);
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

export type RangeKey = 'today' | 'tomorrow' | 'week' | 'next_week' | 'month' | 'last_month' | 'custom';

export function resolveRange(key: RangeKey, from?: string, to?: string): { from: string; to: string } {
  const t = today();
  switch (key) {
    case 'today': return { from: t, to: t };
    case 'tomorrow': return { from: addDays(t, 1), to: addDays(t, 1) };
    case 'week': return { from: startOfWeek(t), to: endOfWeek(t) };
    case 'next_week': { const s = addDays(startOfWeek(t), 7); return { from: s, to: addDays(s, 6) }; }
    case 'month': return { from: startOfMonth(t), to: endOfMonth(t) };
    case 'last_month': { const s = addMonths(t, -1); return { from: s, to: endOfMonth(s) }; }
    default: return { from: from ?? t, to: to ?? from ?? t };
  }
}
