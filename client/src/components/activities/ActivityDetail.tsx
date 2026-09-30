import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Check, Pencil, Trash2, MapPin, Phone, MessageCircle } from 'lucide-react';
import { activitiesApi } from '../../api/services';
import type { Activity } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Dropdown } from '../ui/Dropdown';
import { PriorityBadge, StatusBadge, TypeChip } from '../ui/Badges';
import { ErrorState, ListSkeleton } from '../ui/States';
import { useStatuses } from '../../hooks/useLookups';
import { useToast } from '../../hooks/useToast';
import { ACTIVITY_META } from '../../utils/constants';
import { fmtDate, fmtDateTime, relativeDay, timeRange } from '../../utils/date';
import { errorMessage } from '../../utils/errors';
import { useActivityActions } from './useActivityActions';

interface Props { id: number; onClose: () => void; onEdit: (a: Activity) => void; onComplete: (a: Activity, statusId?: number) => void; onMove: (a: Activity, statusId: number) => void }

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => children ? <div><dt>{label}</dt><dd>{children}</dd></div> : null;

export function ActivityDetail({ id, onClose, onEdit, onComplete, onMove }: Props) {
  const qc = useQueryClient(); const toast = useToast(); const { askDelete } = useActivityActions();
  const q = useQuery({ queryKey: ['activity', id], queryFn: () => activitiesApi.get(id) });
  const a = q.data;
  const statuses = useStatuses(a ? ACTIVITY_META[a.type].scope : undefined);
  const toggle = useMutation({
    mutationFn: ({ itemId, done }: { itemId: number; done: boolean }) => activitiesApi.toggleItem(itemId, done),
    // Marca imediatamente na tela; o servidor confirma em seguida
    onMutate: ({ itemId, done }) => {
      qc.setQueryData<Activity>(['activity', id], (cur) => cur && cur.checklist ? {
        ...cur, checklist: cur.checklist.map((c) => (c.id === itemId ? { ...c, done } : c)),
        checklist_done: cur.checklist_done + (done ? 1 : -1),
      } : cur);
    },
    onSuccess: (r) => { qc.setQueryData(['activity', id], r); qc.invalidateQueries({ queryKey: ['activities'] }); },
    onError: (e) => { qc.invalidateQueries({ queryKey: ['activity', id] }); toast.error(errorMessage(e)); },
  });
  const open = a && !['done', 'canceled'].includes(a.status_kind);

  return (
    <Modal title={a ? <span className="row" style={{ gap: 10 }}><TypeChip type={a.type} /></span> : 'Carregando…'} onClose={onClose} size="lg"
      footer={a && (
        <>
          <Button variant="danger" onClick={async () => { if (await askDelete(a)) onClose(); }}><Trash2 size={15} /> Excluir</Button>
          <span className="spacer" />
          <Dropdown label="Alterar status" trigger={<Button>Alterar status</Button>} align="right">
            <div className="menu-label">Mover para</div>
            {statuses.data?.map((s) => <button key={s.id} disabled={s.id === a.status_id} onClick={() => onMove(a, s.id)}>{s.name}</button>)}
          </Dropdown>
          <Button onClick={() => onEdit(a)}><Pencil size={15} /> Editar</Button>
          {open && <Button variant="success" onClick={() => onComplete(a)}><Check size={15} /> Concluir</Button>}
        </>
      )}>
      {q.isLoading && <ListSkeleton rows={3} />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {a && (
        <div className="col" style={{ gap: 18 }}>
          <div>
            <h2 style={{ fontSize: 20 }}>{a.title}</h2>
            <div className="row row-wrap" style={{ marginTop: 8 }}>
              <StatusBadge kind={a.status_kind} name={a.status_name} overdue={a.is_overdue} /><PriorityBadge priority={a.priority} />
              {a.is_overdue && <span className="badge tone-red">Status: {a.status_name}</span>}
            </div>
          </div>
          <dl className="info-grid" style={{ margin: 0 }}>
            <Row label="Cliente">{a.client_id && <Link to={`/clientes/${a.client_id}`} onClick={onClose}>{a.client_name}</Link>}</Row>
            <Row label="Data">{a.date && `${relativeDay(a.date)} · ${fmtDate(a.date)}`}</Row>
            <Row label="Horário">{a.start_time && timeRange(a)}</Row>
            <Row label="Responsável">{a.assignee_name}</Row>
            <Row label="Local">{a.location && <span className="row"><MapPin size={14} />{a.location}</span>}</Row>
            <Row label="Cidade">{a.client_city}</Row>
            <Row label="Tipo de treinamento">{a.training_type_name}</Row>
            <Row label="Categoria">{a.category_name}</Row>
            <Row label="Próximo acompanhamento">{a.next_followup_date && fmtDate(a.next_followup_date)}</Row>
          </dl>
          {a.client_phone && <div className="row"><a className="btn btn-sm" href={`tel:${a.client_phone}`}><Phone size={14} /> Ligar</a><a className="btn btn-sm" href={`https://wa.me/55${a.client_phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"><MessageCircle size={14} /> WhatsApp</a></div>}
          {(['content', 'description', 'contact_reason', 'situation', 'problems', 'solutions', 'notes'] as const).map((k) => a[k] ? (
            <div key={k}><h3 className="muted small">{{ content: 'Conteúdo', description: 'Descrição', contact_reason: 'Motivo do contato', situation: 'Situação encontrada', problems: 'Problemas relatados', solutions: 'Soluções realizadas', notes: 'Observações' }[k]}</h3><p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{a[k]}</p></div>
          ) : null)}
          {a.checklist && a.checklist.length > 0 && (
            <div>
              <h3 className="muted small">Checklist ({a.checklist_done}/{a.checklist_total})</h3>
              {a.checklist.map((it) => (
                <label key={it.id} className="checklist-row" style={{ cursor: 'pointer' }}>
                  <input type="checkbox" checked={it.done} onChange={(e) => toggle.mutate({ itemId: it.id!, done: e.target.checked })} style={{ width: 17, height: 17, accentColor: 'var(--brand)' }} />
                  <span style={{ textDecoration: it.done ? 'line-through' : 'none', color: it.done ? 'var(--text-3)' : undefined }}>{it.text}</span>
                </label>
              ))}
            </div>
          )}
          {a.completed_at && (
            <div className="alert-item alert-info" style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>
              <Check size={18} /><div><strong>Concluída em {fmtDateTime(a.completed_at)}</strong>{a.completion_note && <span>{a.completion_note}</span>}</div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
