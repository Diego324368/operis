import type { DB } from '../db/connection.js';
import type { AuthUser } from '../types.js';
import { conflict, notFound } from '../utils/errors.js';
import { addHistory, clientHistory } from './history.js';
import { defaultStatus, getStatus } from './statuses.js';
import { listActivities } from './activities.js';
import { today } from '../utils/dates.js';

/** Datas derivadas das atividades: nada é duplicado na tabela de clientes. */
const DERIVED = `
  (SELECT a.date FROM activities a JOIN statuses s ON s.id=a.status_id WHERE a.client_id=c.id AND a.type='installation' AND s.kind!='canceled' AND a.date IS NOT NULL ORDER BY a.date DESC LIMIT 1) AS installation_date,
  (SELECT a.date FROM activities a JOIN statuses s ON s.id=a.status_id WHERE a.client_id=c.id AND a.type='training' AND s.kind!='canceled' AND a.date IS NOT NULL ORDER BY a.date DESC LIMIT 1) AS training_date,
  (SELECT COALESCE(a.completed_date,a.date) d FROM activities a JOIN statuses s ON s.id=a.status_id WHERE a.client_id=c.id AND a.type='followup' AND s.kind='done' ORDER BY d DESC LIMIT 1) AS last_followup,
  (SELECT a.date FROM activities a JOIN statuses s ON s.id=a.status_id WHERE a.client_id=c.id AND a.type='followup' AND s.kind IN ('pending','scheduled','in_progress','attention') AND a.date IS NOT NULL ORDER BY a.date LIMIT 1) AS next_followup,
  (SELECT COUNT(*) FROM activities a JOIN statuses s ON s.id=a.status_id WHERE a.client_id=c.id AND s.kind IN ('pending','scheduled','in_progress','attention')) AS open_activities`;

const SELECT = `SELECT c.*, s.name AS status_name, s.kind AS status_kind, s.color AS status_color, u.name AS assignee_name, ${DERIVED}
  FROM clients c JOIN statuses s ON s.id = c.status_id LEFT JOIN users u ON u.id = c.assignee_id`;

const norm = (s?: string | null) => (s ?? '').replace(/\D/g, '');
const shape = (r: any) => ({ ...r, is_favorite: !!r.is_favorite });

export interface ClientFilters {
  q?: string; status_id?: number; city?: string; assignee_id?: number; favorite?: boolean;
  sort?: string; order?: 'asc' | 'desc'; page?: number; page_size?: number;
}

const SORTABLE: Record<string, string> = {
  name: 'c.name COLLATE NOCASE', created_at: 'c.created_at', city: 'c.city COLLATE NOCASE',
  next_followup: 'next_followup IS NULL, next_followup', installation_date: 'installation_date IS NULL, installation_date',
  training_date: 'training_date IS NULL, training_date', status: 's.position',
};

export function listClients(db: DB, f: ClientFilters = {}) {
  const where: string[] = []; const p: Record<string, unknown> = {};
  if (f.q) {
    where.push('(c.name LIKE :q OR c.trade_name LIKE :q OR c.contact_name LIKE :q OR c.phone LIKE :q OR c.whatsapp LIKE :q OR c.email LIKE :q OR c.city LIKE :q)');
    p.q = `%${f.q.replace(/[%_]/g, '')}%`;
  }
  if (f.status_id) { where.push('c.status_id = :st'); p.st = f.status_id; }
  if (f.city) { where.push('c.city = :city COLLATE NOCASE'); p.city = f.city; }
  if (f.assignee_id) { where.push('c.assignee_id = :as'); p.as = f.assignee_id; }
  if (f.favorite) where.push('c.is_favorite = 1');
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (db.prepare(`SELECT COUNT(*) n FROM clients c ${w}`).get(p) as { n: number }).n;
  const pageSize = Math.min(f.page_size ?? 50, 200); const page = Math.max(f.page ?? 1, 1);
  const col = SORTABLE[f.sort ?? 'name'] ?? SORTABLE.name;
  const dir = f.order === 'desc' ? 'DESC' : 'ASC';
  const order = col.includes('IS NULL') ? col.replace(/, ([^,]+)$/, `, $1 ${dir}`) : `${col} ${dir}`;
  const items = db.prepare(`${SELECT} ${w} ORDER BY c.is_favorite DESC, ${order}, c.id LIMIT :limit OFFSET :offset`).all({ ...p, limit: pageSize, offset: (page - 1) * pageSize });
  return { items: items.map(shape), total, page, page_size: pageSize };
}

export function getClient(db: DB, id: number) {
  const c = db.prepare(`${SELECT} WHERE c.id = ?`).get(id);
  if (!c) throw notFound('Cliente');
  return shape(c);
}

export function clientDetail(db: DB, user: AuthUser, id: number) {
  const client = getClient(db, id);
  const activities = listActivities(db, user, { client_id: id, sort: 'date' });
  return { client, activities, history: clientHistory(db, id) };
}

function findDuplicates(db: DB, d: { name: string; city?: string | null; phone?: string | null; whatsapp?: string | null }, excludeId = 0) {
  const rows = db.prepare('SELECT id, name, city, phone, whatsapp FROM clients WHERE id != ?').all(excludeId) as any[];
  const phones = [norm(d.phone), norm(d.whatsapp)].filter((x) => x.length >= 10);
  return rows.filter(
    (r) =>
      (r.name.trim().toLowerCase() === d.name.trim().toLowerCase() && (r.city ?? '').toLowerCase() === (d.city ?? '').toLowerCase()) ||
      phones.some((ph) => ph === norm(r.phone) || ph === norm(r.whatsapp)),
  );
}

const F = ['name','trade_name','contact_name','phone','whatsapp','email','address','city','notes','status_id','assignee_id'] as const;

export function createClient(db: DB, user: AuthUser, d: any) {
  const dup = findDuplicates(db, d);
  if (dup.length && !d.force) throw conflict(`Já existe cliente parecido cadastrado: ${dup.map((x) => x.name).join(', ')}.`, 'DUPLICATE_CLIENT', { duplicates: dup });
  if (d.status_id) getStatus(db, d.status_id);
  const status = d.status_id ?? defaultStatus(db, 'client').id;
  return db.transaction(() => {
    const r = db.prepare(`INSERT INTO clients (${F.join(',')}, is_favorite) VALUES (${F.map((c) => `@${c}`).join(',')}, @fav)`).run({
      ...Object.fromEntries(F.map((c) => [c, d[c] ?? null])), status_id: status, assignee_id: d.assignee_id ?? user.id, fav: d.is_favorite ? 1 : 0,
    });
    const id = Number(r.lastInsertRowid);
    addHistory(db, { clientId: id, userId: user.id, type: 'client_created', description: 'Cliente cadastrado' });
    return getClient(db, id);
  })();
}

export function updateClient(db: DB, user: AuthUser, id: number, d: any) {
  const cur = getClient(db, id);
  const dup = findDuplicates(db, d, id);
  if (dup.length && !d.force) throw conflict(`Já existe cliente parecido cadastrado: ${dup.map((x) => x.name).join(', ')}.`, 'DUPLICATE_CLIENT', { duplicates: dup });
  const status = d.status_id ?? cur.status_id;
  getStatus(db, status);
  db.transaction(() => {
    db.prepare(`UPDATE clients SET ${F.map((c) => `${c}=@${c}`).join(',')}, is_favorite=@fav, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=@id`).run({
      ...Object.fromEntries(F.map((c) => [c, d[c] ?? null])), status_id: status, id, fav: (d.is_favorite ?? cur.is_favorite) ? 1 : 0,
    });
    if (status !== cur.status_id) {
      const s = getStatus(db, status);
      addHistory(db, { clientId: id, userId: user.id, type: 'client_status', description: `Status do cliente alterado para "${s.name}"` });
    }
  })();
  return getClient(db, id);
}

export function setFavorite(db: DB, id: number, fav: boolean) {
  getClient(db, id);
  db.prepare('UPDATE clients SET is_favorite = ? WHERE id = ?').run(fav ? 1 : 0, id);
  return getClient(db, id);
}

export function addQuickNote(db: DB, user: AuthUser, id: number, text: string) {
  getClient(db, id);
  addHistory(db, { clientId: id, userId: user.id, type: 'note', description: text });
}

export function deleteClient(db: DB, id: number) {
  getClient(db, id);
  db.prepare('DELETE FROM clients WHERE id = ?').run(id);
}

export function listCities(db: DB) {
  return (db.prepare(`SELECT DISTINCT city FROM clients WHERE city IS NOT NULL AND city != '' ORDER BY city COLLATE NOCASE`).all() as { city: string }[]).map((r) => r.city);
}

/**
 * Clientes em andamento que já tiveram instalação/treinamento concluído, não têm
 * acompanhamento futuro e cujo último contato (acompanhamento ou entrega) passou de N dias.
 */
export function clientsNeedingFollowup(db: DB, days: number) {
  const limit = new Date(`${today()}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() - days);
  const cutoff = limit.toISOString().slice(0, 10);
  const rows = db.prepare(`
    SELECT *, COALESCE(last_followup, delivered_on) AS last_contact FROM (
      SELECT c.*, s.name AS status_name, s.kind AS status_kind, ${DERIVED},
        (SELECT MAX(COALESCE(a.completed_date, a.date)) FROM activities a JOIN statuses s2 ON s2.id=a.status_id
          WHERE a.client_id=c.id AND a.type IN ('installation','training') AND s2.kind='done') AS delivered_on
      FROM clients c JOIN statuses s ON s.id=c.status_id WHERE s.kind NOT IN ('done','canceled'))
    WHERE next_followup IS NULL AND delivered_on IS NOT NULL AND COALESCE(last_followup, delivered_on) <= ?
    ORDER BY last_contact`).all(cutoff) as any[];
  return rows.map(shape);
}
