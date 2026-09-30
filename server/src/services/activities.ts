import type { DB } from '../db/connection.js';
import { ACTIVITY_LABEL, scopeOf, type ActivityType, type AuthUser } from '../types.js';
import { AppError, badRequest, conflict, forbidden, notFound } from '../utils/errors.js';
import { nowParts, resolveRange, timeToMinutes, type RangeKey } from '../utils/dates.js';
import { addHistory } from './history.js';
import { defaultStatus, firstStatusOfKind, getStatus } from './statuses.js';
import { getSettings } from './settings.js';

const BASE_SELECT = `
SELECT a.*,
  c.name AS client_name, c.trade_name AS client_trade_name, c.city AS client_city, c.phone AS client_phone,
  s.name AS status_name, s.kind AS status_kind, s.color AS status_color,
  u.name AS assignee_name, tt.name AS training_type_name, tc.name AS category_name,
  (SELECT COUNT(*) FROM checklist_items WHERE activity_id = a.id) AS checklist_total,
  (SELECT COUNT(*) FROM checklist_items WHERE activity_id = a.id AND done = 1) AS checklist_done,
  CASE WHEN s.kind NOT IN ('done','canceled') AND a.date IS NOT NULL AND
    (a.date < :today OR (a.date = :today AND COALESCE(a.end_time, a.start_time) IS NOT NULL AND COALESCE(a.end_time, a.start_time) < :now))
    THEN 1 ELSE 0 END AS is_overdue
FROM activities a
LEFT JOIN clients c ON c.id = a.client_id
JOIN statuses s ON s.id = a.status_id
LEFT JOIN users u ON u.id = a.assignee_id
LEFT JOIN training_types tt ON tt.id = a.training_type_id
LEFT JOIN task_categories tc ON tc.id = a.category_id`;

export interface ActivityFilters {
  type?: string; status_id?: number; kind?: string; client_id?: number; assignee_id?: number;
  city?: string; priority?: string; range?: RangeKey; from?: string; to?: string;
  q?: string; overdue?: boolean; sort?: 'date' | 'priority' | 'created';
}

const bool = (x: any) => ({ ...x, is_overdue: !!x.is_overdue });

export function listActivities(db: DB, user: AuthUser, f: ActivityFilters = {}) {
  const now = nowParts();
  const where: string[] = [];
  const p: Record<string, unknown> = { today: now.date, now: now.time };
  if (user.role !== 'admin') { where.push('a.assignee_id = :me'); p.me = user.id; }
  if (f.type) {
    const types = f.type.split(',').filter(Boolean);
    where.push(`a.type IN (${types.map((_, i) => `:t${i}`).join(',')})`);
    types.forEach((t, i) => (p[`t${i}`] = t));
  }
  if (f.status_id) { where.push('a.status_id = :sid'); p.sid = f.status_id; }
  if (f.kind) {
    const kinds = f.kind.split(',').filter(Boolean);
    where.push(`s.kind IN (${kinds.map((_, i) => `:k${i}`).join(',')})`);
    kinds.forEach((k, i) => (p[`k${i}`] = k));
  }
  if (f.client_id) { where.push('a.client_id = :cid'); p.cid = f.client_id; }
  if (f.assignee_id) { where.push('a.assignee_id = :aid'); p.aid = f.assignee_id; }
  if (f.city) { where.push('c.city = :city COLLATE NOCASE'); p.city = f.city; }
  if (f.priority) { where.push('a.priority = :prio'); p.prio = f.priority; }
  if (f.range) {
    const r = resolveRange(f.range, f.from, f.to);
    where.push('a.date BETWEEN :from AND :to');
    p.from = r.from; p.to = r.to;
  } else if (f.from || f.to) {
    where.push('a.date BETWEEN :from AND :to');
    p.from = f.from ?? '0000-01-01'; p.to = f.to ?? '9999-12-31';
  }
  if (f.q) {
    where.push(`(a.title LIKE :q OR c.name LIKE :q OR c.trade_name LIKE :q OR c.phone LIKE :q OR c.city LIKE :q OR u.name LIKE :q OR s.name LIKE :q OR a.notes LIKE :q)`);
    p.q = `%${f.q.replace(/[%_]/g, '')}%`;
  }
  if (f.overdue) where.push(`s.kind NOT IN ('done','canceled') AND a.date IS NOT NULL AND (a.date < :today OR (a.date = :today AND COALESCE(a.end_time, a.start_time) IS NOT NULL AND COALESCE(a.end_time, a.start_time) < :now))`);
  const order =
    f.sort === 'priority' ? `CASE a.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, a.date IS NULL, a.date, a.start_time`
    : f.sort === 'created' ? 'a.created_at DESC'
    : `a.date IS NULL, a.date, a.start_time IS NULL, a.start_time, a.id`;
  const sql = `${BASE_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY ${order} LIMIT 2000`;
  return (db.prepare(sql).all(p) as any[]).map(bool);
}

function assertAccess(user: AuthUser, a: { assignee_id: number | null }) {
  if (user.role !== 'admin' && a.assignee_id !== user.id) throw forbidden('Esta atividade está atribuída a outro responsável.');
}

export function getActivity(db: DB, user: AuthUser, id: number) {
  const now = nowParts();
  const a = db.prepare(`${BASE_SELECT} WHERE a.id = :id`).get({ id, today: now.date, now: now.time }) as any;
  if (!a) throw notFound('Atividade');
  assertAccess(user, a);
  a.checklist = db.prepare('SELECT id, text, done FROM checklist_items WHERE activity_id = ? ORDER BY position, id').all(id).map((c: any) => ({ ...c, done: !!c.done }));
  return bool(a);
}

/** Conflitos de horário para o mesmo responsável no mesmo dia. */
export function findConflicts(db: DB, d: { assignee_id?: number | null; date?: string | null; start_time?: string | null; end_time?: string | null }, excludeId?: number) {
  if (!d.date || !d.start_time) return [];
  const dur = getSettings(db).default_duration_minutes;
  const s1 = timeToMinutes(d.start_time);
  const e1 = d.end_time ? timeToMinutes(d.end_time) : s1 + dur;
  const rows = db
    .prepare(
      `SELECT a.id, a.type, a.title, a.start_time, a.end_time, c.name AS client_name FROM activities a
       JOIN statuses s ON s.id = a.status_id LEFT JOIN clients c ON c.id = a.client_id
       WHERE a.date = ? AND a.start_time IS NOT NULL AND s.kind NOT IN ('done','canceled')
         AND COALESCE(a.assignee_id,0) = COALESCE(?,0) AND a.id != ?`,
    )
    .all(d.date, d.assignee_id ?? null, excludeId ?? 0) as any[];
  return rows.filter((r) => {
    const s2 = timeToMinutes(r.start_time);
    const e2 = r.end_time ? timeToMinutes(r.end_time) : s2 + dur;
    return s1 < e2 && s2 < e1;
  });
}

function conflictError(list: any[]) {
  const txt = list.map((c) => `${ACTIVITY_LABEL[c.type as ActivityType]}${c.client_name ? ` com ${c.client_name}` : ''} (${c.start_time}${c.end_time ? `–${c.end_time}` : ''})`).join('; ');
  return conflict(`Conflito de horário: já existe ${txt} nesse período.`, 'SCHEDULE_CONFLICT', { conflicts: list });
}

function makeTitle(db: DB, type: ActivityType, clientId: number | null, title?: string | null) {
  if (title) return title;
  const c = clientId ? (db.prepare('SELECT name FROM clients WHERE id = ?').get(clientId) as { name: string } | undefined) : undefined;
  return `${ACTIVITY_LABEL[type]}${c ? ` — ${c.name}` : ''}`;
}

const fmtBR = (d?: string | null) => (d ? d.split('-').reverse().join('/') : '');
const when = (a: { date?: string | null; start_time?: string | null }) => (a.date ? `${fmtBR(a.date)}${a.start_time ? ` às ${a.start_time}` : ''}` : '');

function saveChecklist(db: DB, activityId: number, items?: { id?: number; text: string; done: boolean }[]) {
  if (!items) return;
  db.prepare('DELETE FROM checklist_items WHERE activity_id = ?').run(activityId);
  const ins = db.prepare('INSERT INTO checklist_items (activity_id,text,done,position) VALUES (?,?,?,?)');
  items.forEach((it, i) => ins.run(activityId, it.text, it.done ? 1 : 0, i));
}

function validateRefs(db: DB, d: any) {
  if (d.client_id && !db.prepare('SELECT 1 FROM clients WHERE id = ?').get(d.client_id)) throw badRequest('O cliente selecionado não existe mais.');
  if (d.assignee_id && !db.prepare('SELECT 1 FROM users WHERE id = ? AND active = 1').get(d.assignee_id)) throw badRequest('O responsável selecionado não existe ou está inativo.');
  if (d.training_type_id && !db.prepare('SELECT 1 FROM training_types WHERE id = ?').get(d.training_type_id)) throw badRequest('Tipo de treinamento inválido.');
  if (d.category_id && !db.prepare('SELECT 1 FROM task_categories WHERE id = ?').get(d.category_id)) throw badRequest('Categoria inválida.');
}

const COLS = ['type','client_id','title','description','status_id','priority','assignee_id','date','start_time','end_time','location','notes','training_type_id','content','contact_reason','situation','problems','solutions','next_followup_date','category_id'] as const;

export function createActivity(db: DB, user: AuthUser, input: any) {
  validateRefs(db, input);
  const type = input.type as ActivityType;
  const scope = scopeOf(type);
  let status = input.status_id ? getStatus(db, input.status_id) : undefined;
  if (status && status.scope !== scope) throw badRequest('Esse status não pertence a este tipo de atividade.');
  if (!status) status = (input.date ? firstStatusOfKind(db, scope, 'scheduled') : undefined) ?? defaultStatus(db, scope);
  if (status.kind === 'scheduled' && !input.date) throw new AppError(400, 'Informe a data para agendar.', 'VALIDATION', { fields: { date: 'Informe a data para agendar.' } });
  const isOpen = !['done', 'canceled'].includes(status.kind);
  const assignee = input.assignee_id ?? user.id;
  if (isOpen && !input.force) {
    const c = findConflicts(db, { ...input, assignee_id: assignee });
    if (c.length) throw conflictError(c);
  }
  const row = { ...input, priority: input.priority ?? 'medium', assignee_id: assignee, status_id: status.id, title: makeTitle(db, type, input.client_id ?? null, input.title) };
  return db.transaction(() => {
    const r = db.prepare(`INSERT INTO activities (${COLS.join(',')}, created_by) VALUES (${COLS.map((c) => `@${c}`).join(',')}, @created_by)`).run(
      Object.fromEntries([...COLS.map((c) => [c, row[c] ?? null]), ['created_by', user.id]]),
    );
    const id = Number(r.lastInsertRowid);
    saveChecklist(db, id, input.checklist);
    if (status!.kind === 'done') markDone(db, user, id, null);
    addHistory(db, {
      clientId: row.client_id, activityId: id, userId: user.id,
      type: status!.kind === 'scheduled' ? 'activity_scheduled' : 'activity_created',
      description: `${ACTIVITY_LABEL[type]} ${status!.kind === 'scheduled' ? 'agendada' : 'criada'}${row.date ? ` para ${when(row)}` : ''}`,
    });
    return getActivity(db, user, id);
  })();
}

export function updateActivity(db: DB, user: AuthUser, id: number, input: any) {
  const cur = getActivity(db, user, id);
  validateRefs(db, input);
  if (input.type !== cur.type && scopeOf(input.type) !== scopeOf(cur.type)) throw badRequest('Não é possível mudar o tipo desta atividade.');
  const scope = scopeOf(cur.type);
  const status = input.status_id ? getStatus(db, input.status_id) : getStatus(db, cur.status_id);
  if (status.scope !== scope) throw badRequest('Esse status não pertence a este tipo de atividade.');
  if (status.kind === 'scheduled' && !input.date) throw new AppError(400, 'Informe a data para agendar.', 'VALIDATION', { fields: { date: 'Informe a data para agendar.' } });
  if (!['done', 'canceled'].includes(status.kind) && !input.force) {
    const c = findConflicts(db, input, id);
    if (c.length) throw conflictError(c);
  }
  const row = { ...input, priority: input.priority ?? cur.priority, type: cur.type, status_id: status.id, title: makeTitle(db, cur.type, input.client_id ?? null, input.title) };
  return db.transaction(() => {
    db.prepare(`UPDATE activities SET ${COLS.map((c) => `${c}=@${c}`).join(',')}, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=@id`).run({
      ...Object.fromEntries(COLS.map((c) => [c, row[c] ?? null])), id,
    });
    saveChecklist(db, id, input.checklist);
    const changedWhen = cur.date !== (row.date ?? null) || cur.start_time !== (row.start_time ?? null);
    if (status.id !== cur.status_id) applyStatusEffects(db, user, cur, status, null);
    else if (changedWhen && row.date)
      addHistory(db, { clientId: cur.client_id, activityId: id, userId: user.id, type: 'activity_rescheduled', description: `${ACTIVITY_LABEL[cur.type as ActivityType]} reagendada para ${when(row)}` });
    return getActivity(db, user, id);
  })();
}

function markDone(db: DB, user: AuthUser, id: number, note: string | null) {
  const n = nowParts();
  db.prepare(`UPDATE activities SET completed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), completed_date = ?, completed_by = ?, completion_note = COALESCE(?, completion_note) WHERE id = ?`).run(n.date, user.id, note, id);
}

/** Efeitos colaterais de mudar o status: conclusão, histórico. */
function applyStatusEffects(db: DB, user: AuthUser, cur: any, status: { id: number; kind: string; name: string }, note: string | null) {
  const label = ACTIVITY_LABEL[cur.type as ActivityType];
  if (status.kind === 'done') {
    markDone(db, user, cur.id, note);
    addHistory(db, { clientId: cur.client_id, activityId: cur.id, userId: user.id, type: 'activity_completed', description: `${label} concluída`, details: { note, status: status.name } });
  } else {
    if (cur.status_kind === 'done') db.prepare('UPDATE activities SET completed_at=NULL, completed_date=NULL, completed_by=NULL WHERE id = ?').run(cur.id);
    addHistory(db, { clientId: cur.client_id, activityId: cur.id, userId: user.id, type: status.kind === 'canceled' ? 'activity_canceled' : 'status_changed', description: `${label}: status alterado para "${status.name}"`, details: { note } });
  }
}

export function changeStatus(db: DB, user: AuthUser, id: number, statusId: number, note: string | null = null) {
  const cur = getActivity(db, user, id);
  const status = getStatus(db, statusId);
  if (status.scope !== scopeOf(cur.type)) throw badRequest('Esse status não pertence a este tipo de atividade.');
  if (status.id === cur.status_id) return cur;
  db.transaction(() => {
    db.prepare(`UPDATE activities SET status_id = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).run(status.id, id);
    applyStatusEffects(db, user, cur, status, note);
  })();
  return getActivity(db, user, id);
}

/** Conclui a atividade usando o primeiro status "Concluído" do módulo; para acompanhamentos pode já criar o próximo. */
export function completeActivity(db: DB, user: AuthUser, id: number, d: { note?: string | null; next_followup_date?: string | null; status_id?: number | null }) {
  const cur = getActivity(db, user, id);
  if (cur.status_kind === 'done') throw badRequest('Esta atividade já está concluída.');
  const chosen = d.status_id ? getStatus(db, d.status_id) : undefined;
  if (chosen && (chosen.kind !== 'done' || chosen.scope !== scopeOf(cur.type))) throw badRequest('Status de conclusão inválido.');
  const done = chosen ?? firstStatusOfKind(db, scopeOf(cur.type), 'done');
  if (!done) throw badRequest('Nenhum status de conclusão configurado.');
  let next: any = null;
  db.transaction(() => {
    if (d.next_followup_date && cur.type === 'followup')
      db.prepare('UPDATE activities SET next_followup_date = ? WHERE id = ?').run(d.next_followup_date, id);
    changeStatus(db, user, id, done.id, d.note ?? null);
    if (d.next_followup_date && cur.type === 'followup' && cur.client_id) {
      next = createActivity(db, user, {
        type: 'followup', client_id: cur.client_id, assignee_id: cur.assignee_id, priority: cur.priority,
        date: d.next_followup_date, contact_reason: 'Acompanhamento de continuidade', force: true,
      });
    }
  })();
  return { activity: getActivity(db, user, id), next_followup: next };
}

export function deleteActivity(db: DB, user: AuthUser, id: number) {
  const cur = getActivity(db, user, id);
  db.transaction(() => {
    addHistory(db, { clientId: cur.client_id, userId: user.id, type: 'activity_deleted', description: `${ACTIVITY_LABEL[cur.type as ActivityType]} excluída (${cur.title})` });
    db.prepare('DELETE FROM activities WHERE id = ?').run(id);
  })();
}

export function toggleChecklistItem(db: DB, user: AuthUser, itemId: number, done: boolean) {
  const it = db.prepare('SELECT activity_id FROM checklist_items WHERE id = ?').get(itemId) as { activity_id: number } | undefined;
  if (!it) throw notFound('Item');
  getActivity(db, user, it.activity_id);
  db.prepare('UPDATE checklist_items SET done = ? WHERE id = ?').run(done ? 1 : 0, itemId);
  return getActivity(db, user, it.activity_id);
}

/**
 * Atividades "do período" para relatórios: concluídas pela data de conclusão;
 * as demais pela data prevista (ou de criação, se ainda sem data).
 */
export function activitiesInPeriod(db: DB, user: AuthUser, from: string, to: string) {
  const now = nowParts();
  const ref = `CASE WHEN s.kind = 'done' THEN COALESCE(a.completed_date, a.date) ELSE COALESCE(a.date, substr(a.created_at,1,10)) END`;
  const scope = user.role === 'admin' ? '' : 'AND a.assignee_id = :me';
  const sql = `${BASE_SELECT} WHERE ${ref} BETWEEN :from AND :to ${scope} ORDER BY ${ref}, a.start_time IS NULL, a.start_time, a.id`;
  return (db.prepare(sql).all({ today: now.date, now: now.time, from, to, ...(scope ? { me: user.id } : {}) }) as any[]).map((r) => ({
    ...bool(r), ref_date: r.completed_date && r.status_kind === 'done' ? r.completed_date : (r.date ?? r.created_at.slice(0, 10)),
  }));
}
