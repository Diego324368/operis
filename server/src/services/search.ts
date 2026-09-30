import type { DB } from '../db/connection.js';
import { ACTIVITY_LABEL, type ActivityType, type AuthUser } from '../types.js';
import { listActivities } from './activities.js';
import { listClients } from './clients.js';

const TYPE_WORDS: Record<string, ActivityType> = {
  instalacao: 'installation', instalação: 'installation', treinamento: 'training', acompanhamento: 'followup',
  tarefa: 'task', reuniao: 'meeting', reunião: 'meeting', evento: 'event',
};

/** Busca global: clientes, atividades (por texto, tipo ou data) e histórico. */
export function globalSearch(db: DB, user: AuthUser, raw: string) {
  const q = raw.trim();
  if (q.length < 2) return { clients: [], activities: [], history: [] };
  const clients = listClients(db, { q, page_size: 8 }).items;

  let activities: any[] = [];
  const dm = q.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
  const type = TYPE_WORDS[q.toLowerCase()];
  if (dm) {
    const year = dm[3] ?? new Date().getFullYear();
    const iso = `${year}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}`;
    activities = listActivities(db, user, { from: iso, to: iso });
  } else if (type) activities = listActivities(db, user, { type, sort: 'date' });
  else activities = listActivities(db, user, { q, sort: 'date' });
  activities = activities.slice(0, 15).map((a) => ({ ...a, type_label: ACTIVITY_LABEL[a.type as ActivityType] }));

  const history = db.prepare(`SELECT h.id, h.client_id, h.description, h.occurred_at, c.name AS client_name
    FROM history_events h JOIN clients c ON c.id = h.client_id WHERE h.description LIKE ? OR c.name LIKE ? ORDER BY h.occurred_at DESC LIMIT 6`)
    .all(`%${q.replace(/[%_]/g, '')}%`, `%${q.replace(/[%_]/g, '')}%`);
  return { clients, activities, history };
}
