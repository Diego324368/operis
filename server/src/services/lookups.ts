import type { DB } from '../db/connection.js';
import { conflict, notFound } from '../utils/errors.js';

/** CRUD genérico para tabelas simples de apoio (tipos de treinamento e categorias de tarefa). */
export function lookupService(db: DB, table: 'training_types' | 'task_categories', fk: 'training_type_id' | 'category_id', label: string) {
  const get = (id: number) => {
    const r = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
    if (!r) throw notFound(label);
    return r;
  };
  return {
    list: (all = false) => db.prepare(`SELECT * FROM ${table} ${all ? '' : 'WHERE active = 1'} ORDER BY name`).all(),
    create(name: string) {
      if (db.prepare(`SELECT 1 FROM ${table} WHERE name = ? COLLATE NOCASE`).get(name)) throw conflict(`Já existe: ${name}.`, 'DUPLICATE');
      return get(Number(db.prepare(`INSERT INTO ${table} (name) VALUES (?)`).run(name).lastInsertRowid));
    },
    update(id: number, d: { name: string; active?: boolean }) {
      const cur = get(id) as { active: number };
      if (db.prepare(`SELECT 1 FROM ${table} WHERE name = ? COLLATE NOCASE AND id != ?`).get(d.name, id)) throw conflict(`Já existe: ${d.name}.`, 'DUPLICATE');
      db.prepare(`UPDATE ${table} SET name = ?, active = ? WHERE id = ?`).run(d.name, d.active === undefined ? cur.active : d.active ? 1 : 0, id);
      return get(id);
    },
    /** Exclui; se estiver em uso, apenas desativa (preserva histórico). */
    remove(id: number) {
      get(id);
      const used = (db.prepare(`SELECT COUNT(*) n FROM activities WHERE ${fk} = ?`).get(id) as { n: number }).n;
      if (used > 0) {
        db.prepare(`UPDATE ${table} SET active = 0 WHERE id = ?`).run(id);
        return { deleted: false, deactivated: true };
      }
      db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
      return { deleted: true, deactivated: false };
    },
  };
}
