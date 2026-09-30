import type { DB } from '../db/connection.js';
import type { AuthUser } from '../types.js';
import { addDays, nowParts, startOfMonth, startOfWeek, endOfWeek } from '../utils/dates.js';
import { listActivities } from './activities.js';
import { clientsNeedingFollowup } from './clients.js';
import { getSettings } from './settings.js';

const kindCounts = (db: DB, user: AuthUser, type: string) => {
  const rows = db.prepare(`SELECT s.kind, COUNT(*) n FROM activities a JOIN statuses s ON s.id=a.status_id
    WHERE a.type = ? ${user.role === 'admin' ? '' : 'AND a.assignee_id = ?'} GROUP BY s.kind`).all(...(user.role === 'admin' ? [type] : [type, user.id])) as { kind: string; n: number }[];
  const m = Object.fromEntries(rows.map((r) => [r.kind, r.n])) as Record<string, number>;
  return { pending: m.pending ?? 0, scheduled: m.scheduled ?? 0, in_progress: m.in_progress ?? 0, attention: m.attention ?? 0, done: m.done ?? 0, canceled: m.canceled ?? 0 };
};

export function getDashboard(db: DB, user: AuthUser) {
  const { date: today, time } = nowParts();
  const settings = getSettings(db);
  const open = 'pending,scheduled,in_progress,attention';
  const todayList = listActivities(db, user, { range: 'today', kind: open });
  const overdue = listActivities(db, user, { overdue: true, kind: open });
  const upcoming = listActivities(db, user, { from: addDays(today, 1), to: addDays(today, 7), kind: open });
  const one = <T>(sql: string, ...a: unknown[]) => (db.prepare(sql).get(...a) as { n: number }).n;
  const monthStart = startOfMonth(today);
  const followupClients = clientsNeedingFollowup(db, settings.no_followup_days);

  const alerts: { level: 'danger' | 'warning' | 'info'; kind: string; title: string; message: string; activity_id?: number; client_id?: number | null }[] = [];
  overdue.slice(0, 8).forEach((a) => alerts.push({ level: 'danger', kind: 'overdue', title: `${a.title} atrasada`, message: `Prevista para ${a.date.split('-').reverse().join('/')}${a.start_time ? ` às ${a.start_time}` : ''}`, activity_id: a.id, client_id: a.client_id }));
  todayList.filter((a) => !a.is_overdue).slice(0, 6).forEach((a) => alerts.push({ level: 'info', kind: 'today', title: `Hoje: ${a.title}`, message: a.start_time ? `Às ${a.start_time}` : 'Sem horário definido', activity_id: a.id, client_id: a.client_id }));
  upcoming.filter((a) => a.date <= addDays(today, 2) && ['installation', 'training'].includes(a.type)).forEach((a) =>
    alerts.push({ level: 'warning', kind: 'upcoming', title: `${a.type === 'installation' ? 'Instalação' : 'Treinamento'} próximo(a): ${a.client_name}`, message: `${a.date.split('-').reverse().join('/')}${a.start_time ? ` às ${a.start_time}` : ''}`, activity_id: a.id, client_id: a.client_id }));
  followupClients.slice(0, 6).forEach((c) => alerts.push({ level: 'warning', kind: 'no_followup', title: `${c.name} sem acompanhamento`, message: `Último contato em ${String(c.last_contact).split('-').reverse().join('/')} (mais de ${settings.no_followup_days} dias)`, client_id: c.id }));

  const clientScope = user.role === 'admin' ? '' : 'WHERE assignee_id = ' + Number(user.id);
  return {
    today, now: time,
    kpis: {
      clients_total: one(`SELECT COUNT(*) n FROM clients ${clientScope}`),
      clients_new: one(`SELECT COUNT(*) n FROM clients ${clientScope ? clientScope + ' AND' : 'WHERE'} substr(created_at,1,10) >= ?`, monthStart),
      installations: kindCounts(db, user, 'installation'),
      trainings: kindCounts(db, user, 'training'),
      followups: kindCounts(db, user, 'followup'),
      overdue: overdue.length,
      today: todayList.length,
      next_days: upcoming.length,
      done_this_week: one(`SELECT COUNT(*) n FROM activities WHERE completed_date BETWEEN ? AND ? ${user.role === 'admin' ? '' : 'AND assignee_id = ' + Number(user.id)}`, startOfWeek(today), endOfWeek(today)),
    },
    today_list: todayList,
    overdue,
    upcoming,
    scheduled: {
      installations: upcoming.concat(todayList).filter((a) => a.type === 'installation' && a.status_kind === 'scheduled'),
      trainings: upcoming.concat(todayList).filter((a) => a.type === 'training' && a.status_kind === 'scheduled'),
      followups: upcoming.concat(todayList).filter((a) => a.type === 'followup' && a.status_kind === 'scheduled'),
    },
    alerts,
    followup_clients: followupClients.slice(0, 10),
    favorites: db.prepare(`SELECT c.id, c.name, c.city, s.name AS status_name, s.kind AS status_kind FROM clients c JOIN statuses s ON s.id=c.status_id WHERE c.is_favorite = 1 ORDER BY c.name LIMIT 12`).all(),
  };
}
