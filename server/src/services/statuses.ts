import type { DB } from '../db/connection.js';
import type { StatusScope } from '../types.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';

export interface StatusRow { id: number; scope: StatusScope; name: string; kind: string; color: string | null; position: number }

export const listStatuses = (db: DB, scope?: string) =>
  db.prepare(`SELECT * FROM statuses ${scope ? 'WHERE scope = ?' : ''} ORDER BY scope, position, id`).all(...(scope ? [scope] : [])) as StatusRow[];

export function getStatus(db: DB, id: number) {
  const s = db.prepare('SELECT * FROM statuses WHERE id = ?').get(id) as StatusRow | undefined;
  if (!s) throw notFound('Status');
  return s;
}

/** Status inicial padrão de um escopo: o primeiro da categoria dada. */
export function firstStatusOfKind(db: DB, scope: StatusScope, kind: string) {
  return db.prepare('SELECT * FROM statuses WHERE scope = ? AND kind = ? ORDER BY position, id LIMIT 1').get(scope, kind) as StatusRow | undefined;
}
export function defaultStatus(db: DB, scope: StatusScope) {
  const s = db.prepare('SELECT * FROM statuses WHERE scope = ? ORDER BY position, id LIMIT 1').get(scope) as StatusRow | undefined;
  if (!s) throw badRequest('Nenhum status configurado para este módulo.');
  return s;
}

function usage(db: DB, s: StatusRow) {
  const table = s.scope === 'client' ? 'clients' : 'activities';
  return (db.prepare(`SELECT COUNT(*) n FROM ${table} WHERE status_id = ?`).get(s.id) as { n: number }).n;
}

function assertHasDone(db: DB, scope: StatusScope, excludeId?: number) {
  if (scope === 'client') return;
  const n = (db.prepare(`SELECT COUNT(*) n FROM statuses WHERE scope = ? AND kind = 'done' AND id != ?`).get(scope, excludeId ?? 0) as { n: number }).n;
  if (n === 0) throw badRequest('É necessário manter ao menos um status de categoria "Concluído" neste módulo.');
}

export function createStatus(db: DB, d: { scope?: StatusScope; name: string; kind: string; color?: string | null }) {
  if (!d.scope) throw badRequest('Informe o módulo do status.');
  if (db.prepare('SELECT 1 FROM statuses WHERE scope = ? AND name = ? COLLATE NOCASE').get(d.scope, d.name))
    throw conflict('Já existe um status com esse nome neste módulo.', 'DUPLICATE');
  const pos = (db.prepare('SELECT COALESCE(MAX(position),0)+1 p FROM statuses WHERE scope = ?').get(d.scope) as { p: number }).p;
  const r = db.prepare('INSERT INTO statuses (scope,name,kind,color,position) VALUES (?,?,?,?,?)').run(d.scope, d.name, d.kind, d.color ?? null, pos);
  return getStatus(db, Number(r.lastInsertRowid));
}

export function updateStatus(db: DB, id: number, d: { name: string; kind: string; color?: string | null }) {
  const cur = getStatus(db, id);
  if (db.prepare('SELECT 1 FROM statuses WHERE scope = ? AND name = ? COLLATE NOCASE AND id != ?').get(cur.scope, d.name, id))
    throw conflict('Já existe um status com esse nome neste módulo.', 'DUPLICATE');
  if (cur.kind === 'done' && d.kind !== 'done') assertHasDone(db, cur.scope, id);
  db.prepare('UPDATE statuses SET name=?, kind=?, color=? WHERE id=?').run(d.name, d.kind, d.color ?? cur.color, id);
  return getStatus(db, id);
}

export function deleteStatus(db: DB, id: number, replaceWith?: number) {
  const cur = getStatus(db, id);
  const remaining = (db.prepare('SELECT COUNT(*) n FROM statuses WHERE scope = ? AND id != ?').get(cur.scope, id) as { n: number }).n;
  if (remaining === 0) throw badRequest('Não é possível excluir o único status deste módulo.');
  if (cur.kind === 'done') assertHasDone(db, cur.scope, id);
  const used = usage(db, cur);
  db.transaction(() => {
    if (used > 0) {
      if (!replaceWith) throw conflict(`Este status está em uso por ${used} registro(s). Escolha outro status para substituí-lo.`, 'STATUS_IN_USE', { used });
      const target = getStatus(db, replaceWith);
      if (target.scope !== cur.scope || target.id === id) throw badRequest('Status de substituição inválido.');
      db.prepare(`UPDATE ${cur.scope === 'client' ? 'clients' : 'activities'} SET status_id = ? WHERE status_id = ?`).run(target.id, id);
    }
    db.prepare('DELETE FROM statuses WHERE id = ?').run(id);
  })();
}

export function reorderStatuses(db: DB, scope: string, ids: number[]) {
  const up = db.prepare('UPDATE statuses SET position = ? WHERE id = ? AND scope = ?');
  db.transaction(() => ids.forEach((id, i) => up.run(i + 1, id, scope)))();
  return listStatuses(db, scope);
}
