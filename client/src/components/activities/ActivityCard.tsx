import type { CSSProperties, DragEvent } from 'react';
import { MapPin, Clock, User, CalendarDays, CheckSquare } from 'lucide-react';
import type { Activity } from '../../types';
import { ACTIVITY_META } from '../../utils/constants';
import { fmtDate, relativeDay, timeRange } from '../../utils/date';
import { PriorityBadge, StatusBadge, TypeChip } from '../ui/Badges';

interface CardProps {
  a: Activity; onOpen: (a: Activity) => void; draggable?: boolean; dragging?: boolean;
  onDragStart?: (e: DragEvent, a: Activity) => void; onDragEnd?: () => void; menu?: React.ReactNode;
}

/** Card do Kanban. */
export function ActivityCard({ a, onOpen, draggable, dragging, onDragStart, onDragEnd, menu }: CardProps) {
  const pct = a.checklist_total ? Math.round((a.checklist_done / a.checklist_total) * 100) : 0;
  return (
    <div
      className={`kcard prio-${a.priority} ${a.is_overdue ? 'overdue' : ''} ${dragging ? 'dragging' : ''}`} role="button" tabIndex={0}
      draggable={draggable} onDragStart={(e) => onDragStart?.(e, a)} onDragEnd={onDragEnd}
      onClick={() => onOpen(a)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(a); } }}
      aria-label={`${a.title}, prioridade ${a.priority}`}
    >
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div className="kcard-title">{a.client_name && ['installation', 'training', 'followup'].includes(a.type) ? a.client_name : a.title}</div>
        {menu}
      </div>
      <div className="kcard-meta">
        {a.type === 'training' && a.training_type_name && <div><ACTIVITY_ICON a={a} />{a.training_type_name}</div>}
        {a.type === 'followup' && a.contact_reason && <div className="truncate"><ACTIVITY_ICON a={a} />{a.contact_reason}</div>}
        {a.type === 'task' && a.client_name && <div className="truncate"><User size={13} />{a.client_name}</div>}
        <div><CalendarDays size={13} />{a.date ? `${relativeDay(a.date)} · ${fmtDate(a.date)}` : 'Sem data'}</div>
        {a.start_time && <div><Clock size={13} />{timeRange(a)}</div>}
        {a.client_city && <div><MapPin size={13} />{a.client_city}</div>}
        {a.assignee_name && <div><User size={13} />{a.assignee_name}</div>}
        {a.notes && <div className="truncate" title={a.notes}>“{a.notes}”</div>}
      </div>
      <div className="kcard-foot">
        <PriorityBadge priority={a.priority} />
        <StatusBadge kind={a.status_kind} name={a.status_name} overdue={a.is_overdue} />
        {a.checklist_total > 0 && <><span className="tiny muted row" style={{ gap: 3 }}><CheckSquare size={12} />{a.checklist_done}/{a.checklist_total}</span><div className="progress" aria-hidden><i style={{ width: `${pct}%` }} /></div></>}
      </div>
    </div>
  );
}
const ACTIVITY_ICON = ({ a }: { a: Activity }) => { const I = ACTIVITY_META[a.type].icon; return <I size={13} />; };

/** Linha de lista (Hoje, Atrasados, Dashboard, cliente). */
export function ActivityItem({ a, onOpen, showDate }: { a: Activity; onOpen: (a: Activity) => void; showDate?: boolean }) {
  const m = ACTIVITY_META[a.type]; const Icon = m.icon;
  return (
    <button className="aitem" onClick={() => onOpen(a)} style={{ '--type-color': m.color } as CSSProperties}>
      <div className="aitem-time">{showDate && a.date ? <span className="tiny muted" style={{ display: 'block' }}>{relativeDay(a.date)}</span> : null}{a.start_time ?? '—'}</div>
      <div className="aitem-icon"><Icon size={17} aria-hidden /></div>
      <div className="aitem-main">
        <div className="aitem-title truncate">{a.title}</div>
        <div className="aitem-meta">
          <TypeChip type={a.type} />
          {a.client_name && !a.title.includes(a.client_name) && <span className="truncate">{a.client_name}</span>}
          {a.assignee_name && <span>· {a.assignee_name}</span>}
        </div>
      </div>
      <div className="col aitem-side" style={{ alignItems: 'flex-end', gap: 4 }}>
        <StatusBadge kind={a.status_kind} name={a.status_name} overdue={a.is_overdue} />
        <PriorityBadge priority={a.priority} withLabel={false} />
      </div>
    </button>
  );
}
