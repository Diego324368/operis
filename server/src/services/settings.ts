import type { DB } from '../db/connection.js';
import { DEFAULT_SETTINGS } from '../db/schema.js';

export function getSettings(db: DB) {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const map: Record<string, string> = { ...DEFAULT_SETTINGS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) };
  return {
    no_followup_days: Number(map.no_followup_days),
    reminder_lead_minutes: Number(map.reminder_lead_minutes),
    default_duration_minutes: Number(map.default_duration_minutes),
    browser_notifications: map.browser_notifications === 'true',
    company_name: map.company_name,
    work_start: map.work_start,
    work_end: map.work_end,
  };
}
export type Settings = ReturnType<typeof getSettings>;

export function updateSettings(db: DB, patch: Partial<Settings>) {
  const up = db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  db.transaction(() => {
    for (const [k, v] of Object.entries(patch)) if (v !== undefined) up.run(k, String(v));
  })();
  return getSettings(db);
}
