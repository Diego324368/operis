import { Wrench, GraduationCap, PhoneCall, ListChecks, Users, CalendarDays, Circle, CalendarClock, PlayCircle, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import type { ActivityType, Priority, StatusKind, StatusScope } from '../types';

export const ACTIVITY_META: Record<ActivityType, { label: string; plural: string; icon: typeof Wrench; scope: StatusScope; color: string; fem: boolean }> = {
  installation: { label: 'Instalação', plural: 'Instalações', icon: Wrench, scope: 'installation', color: 'var(--c-install)', fem: true },
  training: { label: 'Treinamento', plural: 'Treinamentos', icon: GraduationCap, scope: 'training', color: 'var(--c-training)', fem: false },
  followup: { label: 'Acompanhamento', plural: 'Acompanhamentos', icon: PhoneCall, scope: 'followup', color: 'var(--c-followup)', fem: false },
  task: { label: 'Tarefa', plural: 'Tarefas', icon: ListChecks, scope: 'task', color: 'var(--c-task)', fem: true },
  meeting: { label: 'Reunião', plural: 'Reuniões', icon: Users, scope: 'event', color: 'var(--c-meeting)', fem: true },
  event: { label: 'Evento', plural: 'Eventos', icon: CalendarDays, scope: 'event', color: 'var(--c-event)', fem: false },
};
export const scopeOf = (t: ActivityType) => ACTIVITY_META[t].scope;

/** Rotas dos quadros Kanban por tipo. */
export const KANBAN_ROUTES: Record<string, ActivityType> = { instalacoes: 'installation', treinamentos: 'training', acompanhamentos: 'followup', tarefas: 'task' };
export const kanbanPath = (t: ActivityType) => `/${Object.entries(KANBAN_ROUTES).find(([, v]) => v === t)?.[0] ?? 'agenda'}`;

export const KIND_META: Record<StatusKind, { label: string; icon: typeof Circle; tone: string }> = {
  pending: { label: 'Pendente', icon: Circle, tone: 'gray' },
  scheduled: { label: 'Agendado', icon: CalendarClock, tone: 'blue' },
  in_progress: { label: 'Em andamento', icon: PlayCircle, tone: 'amber' },
  attention: { label: 'Atenção', icon: AlertTriangle, tone: 'yellow' },
  done: { label: 'Concluído', icon: CheckCircle2, tone: 'green' },
  canceled: { label: 'Cancelado', icon: XCircle, tone: 'red' },
};
export const PRIORITY_META: Record<Priority, { label: string; emoji: string }> = {
  high: { label: 'Alta', emoji: '🔴' }, medium: { label: 'Média', emoji: '🟡' }, low: { label: 'Baixa', emoji: '🟢' },
};
export const HISTORY_ICON_TONE: Record<string, string> = {
  client_created: 'blue', activity_created: 'gray', activity_scheduled: 'blue', activity_rescheduled: 'amber', status_changed: 'amber',
  activity_completed: 'green', activity_canceled: 'red', activity_deleted: 'red', note: 'yellow', client_status: 'blue',
};
export const ACTIVITY_TYPES_ORDER: ActivityType[] = ['installation', 'training', 'followup', 'task', 'meeting', 'event'];
