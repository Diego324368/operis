import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { activitiesApi } from '../../api/services';
import type { Activity } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, Input, Textarea } from '../ui/Form';
import { useToast } from '../../hooks/useToast';
import { ACTIVITY_META } from '../../utils/constants';
import { addDaysISO, todayISO } from '../../utils/date';
import { errorMessage } from '../../utils/errors';

interface Props { activity: Activity; statusId?: number; onClose: () => void; onDone?: () => void }

/** Conclusão rápida: observação opcional e, quando fizer sentido, já agenda o próximo acompanhamento. */
export function CompleteDialog({ activity: a, statusId, onClose, onDone }: Props) {
  const qc = useQueryClient(); const toast = useToast();
  const [note, setNote] = useState('');
  const [next, setNext] = useState('');
  const isFollowup = a.type === 'followup';
  const offerFollowup = a.type === 'training' || a.type === 'installation';
  const m = ACTIVITY_META[a.type];

  const save = useMutation({
    mutationFn: async () => {
      const r = await activitiesApi.complete(a.id, { note: note || undefined, next_followup_date: isFollowup && next ? next : undefined, ...(statusId ? { status_id: statusId } : {}) } as any);
      if (offerFollowup && next && a.client_id) await activitiesApi.create({ type: 'followup', client_id: a.client_id, assignee_id: a.assignee_id, date: next, contact_reason: `Acompanhamento pós-${a.type === 'training' ? 'treinamento' : 'instalação'}`, force: true });
      return r;
    },
    onSuccess: () => { qc.invalidateQueries(); toast.success(`✓ ${m.label} concluíd${m.fem ? 'a' : 'o'} com sucesso.${next ? ' Próximo acompanhamento agendado.' : ''}`); onDone?.(); onClose(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const quick = [7, 15, 30];
  return (
    <Modal title={`Concluir ${m.label.toLowerCase()}`} onClose={onClose} size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="success" loading={save.isPending} onClick={() => save.mutate()}>Concluir</Button></>}>
      <div className="col" style={{ gap: 14 }}>
        <p className="muted" style={{ margin: 0 }}><b>{a.title}</b><br />Será registrado com sua data, horário e usuário.</p>
        <Field label="Observação (opcional)" htmlFor="cmp-note"><Textarea id="cmp-note" value={note} onChange={(e) => setNote(e.target.value)} autoFocus placeholder="O que foi feito, pendências, combinados…" /></Field>
        {(isFollowup || offerFollowup) && (
          <Field label={isFollowup ? 'Próximo acompanhamento' : 'Agendar primeiro acompanhamento'} htmlFor="cmp-next">
            <Input id="cmp-next" type="date" min={todayISO()} value={next} onChange={(e) => setNext(e.target.value)} />
            <div className="row row-wrap" style={{ marginTop: 4 }}>
              {quick.map((d) => <Button key={d} size="sm" onClick={() => setNext(addDaysISO(todayISO(), d))}>+{d} dias</Button>)}
              {next && <Button size="sm" variant="ghost" onClick={() => setNext('')}>Limpar</Button>}
            </div>
          </Field>
        )}
      </div>
    </Modal>
  );
}
