import type { DB } from '../db/connection.js';
import { ACTIVITY_LABEL, type ActivityType, type AuthUser } from '../types.js';
import { addDays, nowParts, startOfWeek, timeToMinutes } from '../utils/dates.js';
import { clientsNeedingFollowup } from './clients.js';
import { getSettings } from './settings.js';

const br = (d: string) => d.split('-').reverse().join('/');

/**
 * Gera notificações (idempotente via dedupe_key). Chamada periodicamente pelo servidor
 * e ao consultar as notificações. Destinatário: responsável, ou todos os admins.
 */
export function generateNotifications(db: DB) {
  const { date, time } = nowParts();
  const settings = getSettings(db);
  const admins = (db.prepare(`SELECT id FROM users WHERE role='admin' AND active=1`).all() as { id: number }[]).map((u) => u.id);
  const ins = db.prepare(`INSERT OR IGNORE INTO notifications (user_id,kind,title,message,activity_id,client_id,dedupe_key) VALUES (?,?,?,?,?,?,?)`);
  const push = (users: (number | null)[], n: { kind: string; title: string; message: string; activity_id?: number | null; client_id?: number | null; key: string }) => {
    const targets = users.filter((u): u is number => !!u);
    (targets.length ? targets : admins).forEach((u) => ins.run(u, n.kind, n.title, n.message, n.activity_id ?? null, n.client_id ?? null, n.key));
  };

  const rows = db.prepare(`SELECT a.id, a.type, a.title, a.date, a.start_time, a.end_time, a.assignee_id, a.client_id, c.name AS client_name
    FROM activities a JOIN statuses s ON s.id=a.status_id LEFT JOIN clients c ON c.id=a.client_id
    WHERE s.kind IN ('pending','scheduled','in_progress','attention') AND a.date IS NOT NULL AND a.date <= ?`).all(addDays(date, 1)) as any[];

  const nowMin = timeToMinutes(time);
  db.transaction(() => {
    for (const a of rows) {
      const label = ACTIVITY_LABEL[a.type as ActivityType];
      const who = a.client_name ? ` com ${a.client_name}` : '';
      const overdue = a.date < date || (a.date === date && (a.end_time ?? a.start_time) && (a.end_time ?? a.start_time) < time);
      if (overdue) {
        push([a.assignee_id], { kind: 'overdue', title: 'Atrasado', message: `${label}${who} estava prevista(o) para ${br(a.date)}${a.start_time ? ` às ${a.start_time}` : ''}.`, activity_id: a.id, client_id: a.client_id, key: `overdue:${a.id}` });
      } else if (a.date === date) {
        const minutesLeft = a.start_time ? timeToMinutes(a.start_time) - nowMin : null;
        if (minutesLeft !== null && minutesLeft <= settings.reminder_lead_minutes && minutesLeft >= 0)
          push([a.assignee_id], { kind: 'soon', title: `Em breve às ${a.start_time}`, message: `${label}${who} começa em ${minutesLeft} min.`, activity_id: a.id, client_id: a.client_id, key: `soon:${a.id}:${a.date}:${a.start_time}` });
        push([a.assignee_id], { kind: 'today', title: 'Hoje', message: `${label}${who}${a.start_time ? ` às ${a.start_time}` : ''}.`, activity_id: a.id, client_id: a.client_id, key: `today:${a.id}:${a.date}` });
      } else {
        push([a.assignee_id], { kind: 'tomorrow', title: 'Amanhã', message: `${label}${who} agendado(a) para ${a.start_time ?? 'amanhã'}.`, activity_id: a.id, client_id: a.client_id, key: `tomorrow:${a.id}:${a.date}` });
      }
    }
    const week = startOfWeek(date);
    for (const c of clientsNeedingFollowup(db, settings.no_followup_days))
      push([c.assignee_id], { kind: 'no_followup', title: 'Cliente sem acompanhamento', message: `${c.name} está sem acompanhamento desde ${br(c.last_contact)}.`, client_id: c.id, key: `nofollow:${c.id}:${week}` });
  })();
}

export function listNotifications(db: DB, user: AuthUser, limit = 50) {
  generateNotifications(db);
  const items = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?').all(user.id, limit);
  const unread = (db.prepare('SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND read_at IS NULL').get(user.id) as { n: number }).n;
  return { items, unread };
}
export const markRead = (db: DB, user: AuthUser, id: number) =>
  db.prepare(`UPDATE notifications SET read_at = COALESCE(read_at, strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = ? AND user_id = ?`).run(id, user.id);
export const markAllRead = (db: DB, user: AuthUser) =>
  db.prepare(`UPDATE notifications SET read_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE user_id = ? AND read_at IS NULL`).run(user.id);
