import type { CSSProperties } from 'react';
import type { ActivityType, Priority, StatusKind } from '../../types';
import { ACTIVITY_META, KIND_META, PRIORITY_META } from '../../utils/constants';

/** Status sempre com ícone + texto + cor (nunca só cor). */
export function StatusBadge({ kind, name, overdue }: { kind: StatusKind; name: string; overdue?: boolean }) {
  const m = overdue ? { icon: KIND_META.attention.icon, tone: 'red' } : KIND_META[kind];
  const Icon = m.icon;
  return <span className={`badge tone-${m.tone}`}><Icon size={12} aria-hidden />{overdue ? 'Atrasado' : name}</span>;
}
export function PriorityBadge({ priority, withLabel = true }: { priority: Priority; withLabel?: boolean }) {
  const m = PRIORITY_META[priority];
  return <span className={`prio prio-${priority}`} title={`Prioridade ${m.label.toLowerCase()}`}><i className="dot" aria-hidden />{withLabel ? m.label : <span className="sr-only">Prioridade {m.label}</span>}</span>;
}
export function TypeChip({ type }: { type: ActivityType }) {
  const m = ACTIVITY_META[type]; const Icon = m.icon;
  return <span className="type-chip" style={{ '--type-color': m.color } as CSSProperties}><Icon size={14} aria-hidden />{m.label}</span>;
}
export function Avatar({ name, large }: { name: string; large?: boolean }) {
  const i = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
  return <span className={`avatar ${large ? 'avatar-lg' : ''}`} title={name} aria-label={name}>{i}</span>;
}
