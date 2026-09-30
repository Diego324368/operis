/**
 * Esquema do banco (SQLite). Decisões:
 *  - `activities` é uma tabela única para instalações, treinamentos, acompanhamentos,
 *    tarefas, reuniões e eventos, diferenciados por `type`. Isso permite agenda,
 *    atrasos, conflitos e relatórios unificados sem duplicar lógica.
 *  - `statuses` é configurável por tipo; `kind` é a categoria semântica estável
 *    (pending/scheduled/in_progress/attention/done/canceled) usada em relatórios.
 *  - Datas em ISO (YYYY-MM-DD), horas HH:MM, timestamps em UTC ISO-8601.
 */
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS statuses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT NOT NULL CHECK (scope IN ('client','installation','training','followup','task','event')),
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('pending','scheduled','in_progress','attention','done','canceled')),
  color TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  UNIQUE (scope, name)
);

CREATE TABLE IF NOT EXISTS training_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS task_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  trade_name TEXT,
  contact_name TEXT,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  notes TEXT,
  status_id INTEGER NOT NULL REFERENCES statuses(id),
  assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_clients_city ON clients(city);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status_id);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('installation','training','followup','task','meeting','event')),
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status_id INTEGER NOT NULL REFERENCES statuses(id),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
  assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  date TEXT,
  start_time TEXT,
  end_time TEXT,
  location TEXT,
  notes TEXT,
  -- treinamento
  training_type_id INTEGER REFERENCES training_types(id) ON DELETE SET NULL,
  content TEXT,
  -- acompanhamento
  contact_reason TEXT,
  situation TEXT,
  problems TEXT,
  solutions TEXT,
  next_followup_date TEXT,
  -- tarefa
  category_id INTEGER REFERENCES task_categories(id) ON DELETE SET NULL,
  -- conclusão
  completed_at TEXT,
  completed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  completion_note TEXT,
  completed_date TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_act_type_date ON activities(type, date);
CREATE INDEX IF NOT EXISTS idx_act_client ON activities(client_id);
CREATE INDEX IF NOT EXISTS idx_act_status ON activities(status_id);
CREATE INDEX IF NOT EXISTS idx_act_assignee_date ON activities(assignee_id, date);

CREATE TABLE IF NOT EXISTS checklist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_check_act ON checklist_items(activity_id);

CREATE TABLE IF NOT EXISTS history_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  activity_id INTEGER REFERENCES activities(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  description TEXT NOT NULL,
  details TEXT,
  occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_hist_client ON history_events(client_id, occurred_at);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  activity_id INTEGER REFERENCES activities(id) ON DELETE CASCADE,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  dedupe_key TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (user_id, dedupe_key)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS saved_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  period_from TEXT NOT NULL,
  period_to TEXT NOT NULL,
  generated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  snapshot TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
`;

export const DEFAULT_STATUSES: Array<{ scope: string; name: string; kind: string; color: string }> = [
  { scope: 'client', name: 'Novo', kind: 'pending', color: '#64748b' },
  { scope: 'client', name: 'Em implantação', kind: 'in_progress', color: '#2563eb' },
  { scope: 'client', name: 'Ativo', kind: 'in_progress', color: '#16a34a' },
  { scope: 'client', name: 'Finalizado', kind: 'done', color: '#0f766e' },
  { scope: 'client', name: 'Inativo', kind: 'canceled', color: '#dc2626' },
  ...['installation', 'training'].flatMap((scope) => [
    { scope, name: 'Pendente', kind: 'pending', color: '#64748b' },
    { scope, name: 'Agendado', kind: 'scheduled', color: '#2563eb' },
    { scope, name: 'Em andamento', kind: 'in_progress', color: '#d97706' },
    { scope, name: scope === 'installation' ? 'Concluída' : 'Concluído', kind: 'done', color: '#16a34a' },
    { scope, name: scope === 'installation' ? 'Cancelada' : 'Cancelado', kind: 'canceled', color: '#dc2626' },
  ]),
  { scope: 'followup', name: 'Acompanhar', kind: 'pending', color: '#64748b' },
  { scope: 'followup', name: 'Agendado', kind: 'scheduled', color: '#2563eb' },
  { scope: 'followup', name: 'Em contato', kind: 'in_progress', color: '#d97706' },
  { scope: 'followup', name: 'Necessita retorno', kind: 'attention', color: '#ca8a04' },
  { scope: 'followup', name: 'Realizado', kind: 'done', color: '#16a34a' },
  { scope: 'followup', name: 'Finalizado', kind: 'done', color: '#0f766e' },
  { scope: 'task', name: 'A fazer', kind: 'pending', color: '#64748b' },
  { scope: 'task', name: 'Em andamento', kind: 'in_progress', color: '#d97706' },
  { scope: 'task', name: 'Aguardando', kind: 'attention', color: '#ca8a04' },
  { scope: 'task', name: 'Concluída', kind: 'done', color: '#16a34a' },
  { scope: 'task', name: 'Cancelada', kind: 'canceled', color: '#dc2626' },
  { scope: 'event', name: 'Agendado', kind: 'scheduled', color: '#2563eb' },
  { scope: 'event', name: 'Concluído', kind: 'done', color: '#16a34a' },
  { scope: 'event', name: 'Cancelado', kind: 'canceled', color: '#dc2626' },
];

export const DEFAULT_TRAINING_TYPES = [
  'Cadastro de produtos', 'Cadastro de clientes', 'Cadastro de fornecedores', 'Caixa', 'Relatórios',
  'Balcão', 'Delivery', 'Mesa', 'Comanda', 'Emissão fiscal', 'Outros',
];
export const DEFAULT_TASK_CATEGORIES = ['Contato', 'Documentação', 'Confirmação', 'Suporte', 'Pós-venda', 'Outros'];

export const DEFAULT_SETTINGS: Record<string, string> = {
  no_followup_days: '15',
  reminder_lead_minutes: '60',
  default_duration_minutes: '60',
  browser_notifications: 'true',
  company_name: 'Minha Empresa',
  work_start: '08:00',
  work_end: '18:00',
};
