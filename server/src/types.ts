export type Role = 'admin' | 'member';
export interface AuthUser { id: number; name: string; email: string; role: Role }
export type ActivityType = 'installation' | 'training' | 'followup' | 'task' | 'meeting' | 'event';
export type StatusKind = 'pending' | 'scheduled' | 'in_progress' | 'attention' | 'done' | 'canceled';
export type StatusScope = 'client' | 'installation' | 'training' | 'followup' | 'task' | 'event';

export const ACTIVITY_LABEL: Record<ActivityType, string> = {
  installation: 'Instalação', training: 'Treinamento', followup: 'Acompanhamento',
  task: 'Tarefa', meeting: 'Reunião', event: 'Evento',
};
/** Escopo de status usado por cada tipo de atividade. */
export const scopeOf = (t: ActivityType): StatusScope => (t === 'meeting' || t === 'event' ? 'event' : t);
export const OPEN_KINDS = ['pending', 'scheduled', 'in_progress', 'attention'] as const;
