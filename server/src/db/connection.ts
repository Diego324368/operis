import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { DEFAULT_SETTINGS, DEFAULT_STATUSES, DEFAULT_TASK_CATEGORIES, DEFAULT_TRAINING_TYPES, SCHEMA } from './schema.js';

export type DB = Database.Database;

/** Abre (e inicializa) o banco. `:memory:` é aceito para testes. */
export function openDatabase(file = config.databasePath): DB {
  if (file !== ':memory:') mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  bootstrap(db);
  return db;
}

/** Cria dados essenciais (status, tipos, configurações, admin) quando o banco está vazio. */
function bootstrap(db: DB) {
  const tx = db.transaction(() => {
    if (!db.prepare('SELECT 1 FROM statuses LIMIT 1').get()) {
      const ins = db.prepare('INSERT INTO statuses (scope,name,kind,color,position) VALUES (?,?,?,?,?)');
      const pos: Record<string, number> = {};
      for (const s of DEFAULT_STATUSES) {
        pos[s.scope] = (pos[s.scope] ?? 0) + 1;
        ins.run(s.scope, s.name, s.kind, s.color, pos[s.scope]);
      }
      const tt = db.prepare('INSERT INTO training_types (name) VALUES (?)');
      DEFAULT_TRAINING_TYPES.forEach((n) => tt.run(n));
      const tc = db.prepare('INSERT INTO task_categories (name) VALUES (?)');
      DEFAULT_TASK_CATEGORIES.forEach((n) => tc.run(n));
    }
    const st = db.prepare('INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)');
    Object.entries(DEFAULT_SETTINGS).forEach(([k, v]) => st.run(k, v));
    if (!db.prepare('SELECT 1 FROM users LIMIT 1').get()) {
      db.prepare('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)').run(
        config.admin.name, config.admin.email, bcrypt.hashSync(config.admin.password, 10), 'admin',
      );
    }
  });
  tx();
}
