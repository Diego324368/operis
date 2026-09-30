import type { DB } from '../db/connection.js';
import { ACTIVITY_LABEL, type ActivityType, type AuthUser } from '../types.js';
import { addDays, nowParts, parseDate, startOfWeek, timeToMinutes } from '../utils/dates.js';
import { activitiesInPeriod } from './activities.js';
import { badRequest } from '../utils/errors.js';

const TYPES: ActivityType[] = ['installation', 'training', 'followup', 'task', 'meeting', 'event'];
const empty = () => ({ total: 0, done: 0, pending: 0, scheduled: 0, in_progress: 0, attention: 0, canceled: 0, overdue: 0 });

export function getReport(db: DB, user: AuthUser, from: string, to: string) {
  if (from > to) throw badRequest('A data inicial deve ser anterior à data final.');
  if ((parseDate(to).getTime() - parseDate(from).getTime()) / 86400000 > 731) throw badRequest('O período máximo do relatório é de 2 anos.');
  const acts = activitiesInPeriod(db, user, from, to);

  const by_type = Object.fromEntries(TYPES.map((t) => [t, empty()])) as Record<ActivityType, ReturnType<typeof empty>>;
  let minutes = 0;
  const attended = new Set<number>();
  const notes: { date: string; client: string | null; type: string; label: string; text: string }[] = [];
  const perDay = new Map<string, number>();
  const perWeek = new Map<string, { installation: number; training: number; followup: number; other: number }>();

  for (const a of acts) {
    const b = by_type[a.type as ActivityType];
    b.total++;
    (b as any)[a.status_kind]++;
    if (a.is_overdue) b.overdue++;
    if (a.status_kind === 'done') {
      if (a.client_id) attended.add(a.client_id);
      if (a.start_time && a.end_time) minutes += timeToMinutes(a.end_time) - timeToMinutes(a.start_time);
      perDay.set(a.ref_date, (perDay.get(a.ref_date) ?? 0) + 1);
      const wk = startOfWeek(a.ref_date);
      const w = perWeek.get(wk) ?? { installation: 0, training: 0, followup: 0, other: 0 };
      if (a.type === 'installation' || a.type === 'training' || a.type === 'followup') w[a.type as 'installation' | 'training' | 'followup']++; else w.other++;
      perWeek.set(wk, w);
    }
    const text = [a.completion_note, a.problems && `Problemas: ${a.problems}`, a.solutions && `Soluções: ${a.solutions}`, a.notes].filter(Boolean).join(' | ');
    if (text) notes.push({ date: a.ref_date, client: a.client_name, type: a.type, label: ACTIVITY_LABEL[a.type as ActivityType], text });
  }

  const days: { date: string; done: number }[] = [];
  const spanDays = (parseDate(to).getTime() - parseDate(from).getTime()) / 86400000;
  if (spanDays <= 62) for (let d = from; d <= to; d = addDays(d, 1)) days.push({ date: d, done: perDay.get(d) ?? 0 });
  else [...perDay.entries()].sort().forEach(([date, done]) => days.push({ date, done }));

  const one = <T>(sql: string, ...a: unknown[]) => (db.prepare(sql).get(...a) as { n: number }).n;
  const actionable = acts.filter((a) => a.status_kind !== 'canceled');
  const done = actionable.filter((a) => a.status_kind === 'done').length;

  return {
    period: { from, to },
    generated_at: new Date().toISOString(),
    today: nowParts().date,
    by_type,
    clients: {
      new: one(`SELECT COUNT(*) n FROM clients WHERE substr(created_at,1,10) BETWEEN ? AND ?`, from, to),
      active: one(`SELECT COUNT(*) n FROM clients c JOIN statuses s ON s.id=c.status_id WHERE s.kind NOT IN ('done','canceled')`),
      finished: one(`SELECT COUNT(*) n FROM clients c JOIN statuses s ON s.id=c.status_id WHERE s.kind = 'done'`),
      attended: attended.size,
    },
    totals: {
      done, pending: acts.filter((a) => ['pending', 'scheduled', 'in_progress', 'attention'].includes(a.status_kind)).length,
      overdue: acts.filter((a) => a.is_overdue).length,
      canceled: acts.length - actionable.length, total: acts.length,
      completion_rate: actionable.length ? Math.round((done / actionable.length) * 100) : 0,
      minutes_done: minutes,
    },
    productivity: {
      by_day: days,
      by_week: [...perWeek.entries()].sort().map(([week, v]) => ({ week, ...v })),
    },
    activities: acts,
    notes,
  };
}
export type Report = ReturnType<typeof getReport>;

export function saveReport(db: DB, user: AuthUser, title: string, report: Report) {
  const slim = { ...report, activities: report.activities.length };
  const r = db.prepare('INSERT INTO saved_reports (title, period_from, period_to, generated_by, snapshot) VALUES (?,?,?,?,?)').run(title, report.period.from, report.period.to, user.id, JSON.stringify(slim));
  return Number(r.lastInsertRowid);
}
export const listSavedReports = (db: DB) =>
  db.prepare('SELECT id, title, period_from, period_to, created_at FROM saved_reports ORDER BY created_at DESC LIMIT 30').all();
