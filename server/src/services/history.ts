import type { DB } from '../db/connection.js';

export interface HistoryInput {
  clientId?: number | null;
  activityId?: number | null;
  userId?: number | null;
  type: string;
  description: string;
  details?: Record<string, unknown>;
}

export function addHistory(db: DB, h: HistoryInput) {
  db.prepare(
    `INSERT INTO history_events (client_id, activity_id, user_id, event_type, description, details)
     VALUES (?,?,?,?,?,?)`,
  ).run(h.clientId ?? null, h.activityId ?? null, h.userId ?? null, h.type, h.description, h.details ? JSON.stringify(h.details) : null);
}

export function clientHistory(db: DB, clientId: number) {
  return db
    .prepare(
      `SELECT h.*, u.name AS user_name FROM history_events h
       LEFT JOIN users u ON u.id = h.user_id
       WHERE h.client_id = ? ORDER BY h.occurred_at DESC, h.id DESC`,
    )
    .all(clientId)
    .map((r: any) => ({ ...r, details: r.details ? JSON.parse(r.details) : null }));
}
