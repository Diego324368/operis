import bcrypt from 'bcryptjs';
import type { DB } from '../db/connection.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors.js';
import type { AuthUser } from '../types.js';

const PUBLIC = 'id, name, email, role, active, created_at';

export const listUsers = (db: DB, includeInactive = true) =>
  db.prepare(`SELECT ${PUBLIC} FROM users ${includeInactive ? '' : 'WHERE active = 1'} ORDER BY active DESC, name`).all();

export function getUser(db: DB, id: number) {
  const u = db.prepare(`SELECT ${PUBLIC} FROM users WHERE id = ?`).get(id);
  if (!u) throw notFound('Usuário');
  return u as AuthUser & { active: number };
}

export function createUser(db: DB, d: { name: string; email: string; password: string; role: string }) {
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(d.email)) throw conflict('Já existe um usuário com esse e-mail.', 'DUPLICATE');
  const r = db.prepare('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)').run(d.name, d.email, bcrypt.hashSync(d.password, 10), d.role);
  return getUser(db, Number(r.lastInsertRowid));
}

export function updateUser(db: DB, actor: AuthUser, id: number, d: { name?: string; email?: string; password?: string; role?: string; active?: boolean }) {
  const cur = getUser(db, id);
  if (d.email && db.prepare('SELECT 1 FROM users WHERE email = ? AND id != ?').get(d.email, id)) throw conflict('Já existe um usuário com esse e-mail.', 'DUPLICATE');
  const losesAdmin = cur.role === 'admin' && (d.role === 'member' || d.active === false);
  if (losesAdmin) {
    if (id === actor.id) throw badRequest('Você não pode remover seu próprio acesso de administrador.');
    const admins = (db.prepare(`SELECT COUNT(*) n FROM users WHERE role='admin' AND active=1 AND id != ?`).get(id) as { n: number }).n;
    if (admins === 0) throw badRequest('Deve existir ao menos um administrador ativo.');
  }
  db.prepare(`UPDATE users SET name=?, email=?, role=?, active=?, password_hash=COALESCE(?, password_hash) WHERE id=?`).run(
    d.name ?? cur.name, d.email ?? cur.email, d.role ?? cur.role, d.active === undefined ? cur.active : d.active ? 1 : 0,
    d.password ? bcrypt.hashSync(d.password, 10) : null, id,
  );
  return getUser(db, id);
}

export function updateProfile(db: DB, user: AuthUser, d: { name?: string; email?: string; current_password?: string; new_password?: string }) {
  if (d.email && db.prepare('SELECT 1 FROM users WHERE email = ? AND id != ?').get(d.email, user.id)) throw conflict('Já existe um usuário com esse e-mail.', 'DUPLICATE');
  if (d.new_password) {
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id) as { password_hash: string };
    if (!d.current_password || !bcrypt.compareSync(d.current_password, row.password_hash)) throw forbidden('Senha atual incorreta.');
  }
  db.prepare('UPDATE users SET name=COALESCE(?,name), email=COALESCE(?,email), password_hash=COALESCE(?,password_hash) WHERE id=?').run(
    d.name ?? null, d.email ?? null, d.new_password ? bcrypt.hashSync(d.new_password, 10) : null, user.id,
  );
  return getUser(db, user.id);
}
