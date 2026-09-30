export type Role = 'admin' | 'member';
export interface User { id: number; name: string; email: string; role: Role; active?: number }
export type ActivityType = 'installation' | 'training' | 'followup' | 'task' | 'meeting' | 'event';
export type StatusKind = 'pending' | 'scheduled' | 'in_progress' | 'attention' | 'done' | 'canceled';
export type StatusScope = 'client' | 'installation' | 'training' | 'followup' | 'task' | 'event';
export type Priority = 'high' | 'medium' | 'low';

export interface Status { id: number; scope: StatusScope; name: string; kind: StatusKind; color: string | null; position: number }
export interface Lookup { id: number; name: string; active: number }
export interface ChecklistItem { id?: number; text: string; done: boolean }

export interface Activity {
  id: number; type: ActivityType; client_id: number | null; title: string; description: string | null;
  status_id: number; status_name: string; status_kind: StatusKind; status_color: string | null;
  priority: Priority; assignee_id: number | null; assignee_name: string | null;
  date: string | null; start_time: string | null; end_time: string | null; location: string | null; notes: string | null;
  training_type_id: number | null; training_type_name: string | null; content: string | null;
  contact_reason: string | null; situation: string | null; problems: string | null; solutions: string | null; next_followup_date: string | null;
  category_id: number | null; category_name: string | null;
  completed_at: string | null; completed_date: string | null; completion_note: string | null;
  client_name: string | null; client_trade_name: string | null; client_city: string | null; client_phone: string | null;
  checklist_total: number; checklist_done: number; is_overdue: boolean; checklist?: ChecklistItem[];
  created_at: string;
}

export interface Client {
  id: number; name: string; trade_name: string | null; contact_name: string | null; phone: string | null; whatsapp: string | null;
  email: string | null; address: string | null; city: string | null; notes: string | null;
  status_id: number; status_name: string; status_kind: StatusKind; status_color: string | null;
  assignee_id: number | null; assignee_name: string | null; is_favorite: boolean; created_at: string;
  installation_date: string | null; training_date: string | null; last_followup: string | null; next_followup: string | null; open_activities: number;
  last_contact?: string;
}
export interface HistoryEvent { id: number; event_type: string; description: string; occurred_at: string; user_name: string | null; activity_id: number | null; details: { note?: string } | null }

export interface Settings {
  no_followup_days: number; reminder_lead_minutes: number; default_duration_minutes: number;
  browser_notifications: boolean; company_name: string; work_start: string; work_end: string;
}
export type KindCounts = Record<StatusKind, number>;
export interface Alert { level: 'danger' | 'warning' | 'info'; kind: string; title: string; message: string; activity_id?: number; client_id?: number | null }
export interface Dashboard {
  today: string; now: string;
  kpis: { clients_total: number; clients_new: number; installations: KindCounts; trainings: KindCounts; followups: KindCounts; overdue: number; today: number; next_days: number; done_this_week: number };
  today_list: Activity[]; overdue: Activity[]; upcoming: Activity[];
  scheduled: { installations: Activity[]; trainings: Activity[]; followups: Activity[] };
  alerts: Alert[]; followup_clients: Client[];
  favorites: { id: number; name: string; city: string | null; status_name: string; status_kind: StatusKind }[];
}
export interface AppNotification { id: number; kind: string; title: string; message: string; activity_id: number | null; client_id: number | null; read_at: string | null; created_at: string }

export interface TypeStats { total: number; done: number; pending: number; scheduled: number; in_progress: number; attention: number; canceled: number; overdue: number }
export interface Report {
  period: { from: string; to: string }; generated_at: string;
  by_type: Record<ActivityType, TypeStats>;
  clients: { new: number; active: number; finished: number; attended: number };
  totals: { done: number; pending: number; overdue: number; canceled: number; total: number; completion_rate: number; minutes_done: number };
  productivity: { by_day: { date: string; done: number }[]; by_week: { week: string; installation: number; training: number; followup: number; other: number }[] };
  activities: (Activity & { ref_date: string })[];
  notes: { date: string; client: string | null; type: ActivityType; label: string; text: string }[];
}
export interface SearchResult { clients: Client[]; activities: (Activity & { type_label: string })[]; history: { id: number; client_id: number; description: string; occurred_at: string; client_name: string }[] }

export type RangeKey = 'today' | 'tomorrow' | 'week' | 'next_week' | 'month' | 'last_month' | 'custom';
export interface ActivityFilter {
  type?: string; status_id?: number; kind?: string; client_id?: number; assignee_id?: number; city?: string; priority?: string;
  range?: RangeKey; from?: string; to?: string; q?: string; overdue?: boolean; sort?: string;
}
