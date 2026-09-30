import { addDays, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { RangeKey } from '../types';

export const ISO = 'yyyy-MM-dd';
export const toISO = (d: Date) => format(d, ISO);
export const todayISO = () => toISO(new Date());
export const fromISO = (s: string) => parseISO(s);
export const addDaysISO = (s: string, n: number) => toISO(addDays(parseISO(s), n));
export const weekStartISO = (s: string) => toISO(startOfWeek(parseISO(s), { weekStartsOn: 1 }));
export const fmtDate = (s?: string | null) => (s ? format(parseISO(s), 'dd/MM/yyyy') : '—');
export const fmtDateShort = (s: string) => format(parseISO(s), "EEE, dd/MM", { locale: ptBR });
export const fmtDateLong = (s: string) => format(parseISO(s), "EEEE, dd 'de' MMMM", { locale: ptBR });
export const fmtMonthYear = (s: string) => format(parseISO(s), "MMMM 'de' yyyy", { locale: ptBR });
export const fmtDateTime = (iso: string) => format(new Date(iso), "dd/MM/yyyy 'às' HH:mm");

export function relativeDay(s?: string | null) {
  if (!s) return 'Sem data';
  const t = todayISO();
  if (s === t) return 'Hoje';
  if (s === addDaysISO(t, 1)) return 'Amanhã';
  if (s === addDaysISO(t, -1)) return 'Ontem';
  return fmtDateShort(s);
}
export const timeRange = (a: { start_time: string | null; end_time: string | null }) =>
  a.start_time ? (a.end_time ? `${a.start_time}–${a.end_time}` : a.start_time) : 'Sem horário';

export function rangeToDates(key: RangeKey, from?: string, to?: string): { from: string; to: string } {
  const now = new Date();
  switch (key) {
    case 'today': return { from: toISO(now), to: toISO(now) };
    case 'tomorrow': { const d = addDays(now, 1); return { from: toISO(d), to: toISO(d) }; }
    case 'week': return { from: toISO(startOfWeek(now, { weekStartsOn: 1 })), to: toISO(endOfWeek(now, { weekStartsOn: 1 })) };
    case 'next_week': { const s = addDays(startOfWeek(now, { weekStartsOn: 1 }), 7); return { from: toISO(s), to: toISO(addDays(s, 6)) }; }
    case 'month': return { from: toISO(startOfMonth(now)), to: toISO(endOfMonth(now)) };
    case 'last_month': { const m = subMonths(now, 1); return { from: toISO(startOfMonth(m)), to: toISO(endOfMonth(m)) }; }
    default: return { from: from ?? toISO(now), to: to ?? from ?? toISO(now) };
  }
}
export const monthShift = (s: string, n: number) => toISO(addMonths(parseISO(s), n));

export const RANGE_OPTIONS: { value: RangeKey | ''; label: string }[] = [
  { value: '', label: 'Todas as datas' }, { value: 'today', label: 'Hoje' }, { value: 'tomorrow', label: 'Amanhã' },
  { value: 'week', label: 'Esta semana' }, { value: 'next_week', label: 'Próxima semana' }, { value: 'month', label: 'Este mês' },
  { value: 'last_month', label: 'Mês anterior' }, { value: 'custom', label: 'Período personalizado' },
];
