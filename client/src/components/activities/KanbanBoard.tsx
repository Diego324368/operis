import { useRef, useState } from 'react';
import { MoreHorizontal, Plus, Pencil, Trash2, ArrowRightLeft, CheckCircle2 } from 'lucide-react';
import type { Activity, ActivityType, Status } from '../../types';
import { ACTIVITY_META, KIND_META } from '../../utils/constants';
import { ActivityCard } from './ActivityCard';
import { Dropdown } from '../ui/Dropdown';
import { useActivityModals } from './ActivityModals';
import { useActivityActions } from './useActivityActions';

interface Props { type: ActivityType; statuses: Status[]; activities: Activity[] }

const prioRank = { high: 0, medium: 1, low: 2 } as const;

/** Kanban genérico. Desktop: arrastar e soltar. Celular: abas de colunas + menu "Mover para". */
export function KanbanBoard({ type, statuses, activities }: Props) {
  const modals = useActivityModals(); const { askDelete } = useActivityActions();
  const [dragId, setDragId] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const colRefs = useRef<Record<number, HTMLElement | null>>({});
  const meta = ACTIVITY_META[type];

  const byStatus = (id: number) => activities.filter((a) => a.status_id === id).sort((x, y) => prioRank[x.priority] - prioRank[y.priority] || (x.date ?? '9').localeCompare(y.date ?? '9') || (x.start_time ?? '').localeCompare(y.start_time ?? ''));
  const drop = (s: Status) => {
    const a = activities.find((x) => x.id === dragId);
    setDragId(null); setOver(null);
    if (a) modals.move(a, s);
  };

  return (
    <>
      <div className="kanban-tabs" role="tablist" aria-label="Colunas">
        {statuses.map((s) => (
          <button key={s.id} aria-pressed={active === s.id} onClick={() => { setActive(s.id); colRefs.current[s.id]?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' }); }}>
            {s.name} · {byStatus(s.id).length}
          </button>
        ))}
      </div>
      <div className="kanban">
        {statuses.map((s) => {
          const items = byStatus(s.id); const K = KIND_META[s.kind].icon;
          return (
            <section key={s.id} ref={(el) => { colRefs.current[s.id] = el; }} className={`kcol ${over === s.id ? 'drop' : ''}`} aria-label={`${s.name}: ${items.length}`}
              onDragOver={(e) => { if (dragId !== null) { e.preventDefault(); setOver(s.id); } }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null); }} onDrop={(e) => { e.preventDefault(); drop(s); }}>
              <div className="kcol-head"><K size={16} style={{ color: s.color ?? undefined }} aria-hidden /><span className="truncate">{s.name}</span><span className="count">{items.length}</span></div>
              <div className="kcol-body">
                {items.map((a) => (
                  <ActivityCard key={a.id} a={a} draggable dragging={dragId === a.id} onOpen={() => modals.openDetail(a.id)}
                    onDragStart={(e, x) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(x.id)); setDragId(x.id); }} onDragEnd={() => { setDragId(null); setOver(null); }}
                    menu={
                      <Dropdown align="right" label="Ações do card" trigger={<span className="icon-btn" style={{ width: 26, height: 26, marginTop: -4, marginRight: -6 }}><MoreHorizontal size={16} /></span>}>
                        <div className="menu-label"><ArrowRightLeft size={11} /> Mover para</div>
                        {statuses.filter((x) => x.id !== a.status_id).map((x) => <button key={x.id} onClick={() => modals.move(a, x)}>{x.name}</button>)}
                        <hr />
                        {!['done', 'canceled'].includes(a.status_kind) && <button onClick={() => modals.complete(a)}><CheckCircle2 size={14} /> Concluir</button>}
                        <button onClick={() => modals.editActivity(a)}><Pencil size={14} /> Editar</button>
                        <button className="danger" onClick={() => askDelete(a)}><Trash2 size={14} /> Excluir</button>
                      </Dropdown>
                    } />
                ))}
                {items.length === 0 && <div className="tiny muted center" style={{ padding: '10px 0' }}>Nenhum item</div>}
                <button className="add-card" onClick={() => modals.openForm(type, { status_id: s.id })}><Plus size={14} style={{ verticalAlign: -2 }} /> Adicionar {meta.label.toLowerCase()}</button>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
