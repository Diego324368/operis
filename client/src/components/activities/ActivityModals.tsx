import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { activitiesApi } from '../../api/services';
import type { Activity, ActivityType, Status } from '../../types';
import { useAllStatuses } from '../../hooks/useLookups';
import { useToast } from '../../hooks/useToast';
import { errorMessage } from '../../utils/errors';
import { ActivityForm, type FormDefaults } from './ActivityForm';
import { ActivityDetail } from './ActivityDetail';
import { CompleteDialog } from './CompleteDialog';
import { useActivityActions } from './useActivityActions';

interface Api {
  openDetail: (id: number) => void;
  openForm: (type: ActivityType, defaults?: FormDefaults, allowTypeChange?: boolean) => void;
  editActivity: (a: Activity) => void;
  complete: (a: Activity, statusId?: number) => void;
  /** Move para outro status aplicando as regras (conclusão pede confirmação, cancelamento confirma, agendado sem data abre edição). */
  move: (a: Activity, status: Status) => void;
}
const Ctx = createContext<Api>(null!);
export const useActivityModals = () => useContext(Ctx);

/** Ponto único que abre detalhe/formulário/conclusão de atividades em qualquer tela. */
export function ActivityModalsProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient(); const toast = useToast(); const statuses = useAllStatuses();
  const { setStatus, askCancel } = useActivityActions();
  const [detailId, setDetailId] = useState<number | null>(null);
  const [form, setForm] = useState<{ type: ActivityType; defaults?: FormDefaults; activity?: Activity; allowTypeChange?: boolean } | null>(null);
  const [completing, setCompleting] = useState<{ a: Activity; statusId?: number } | null>(null);

  const editActivity = useCallback(async (a: Activity) => {
    try {
      const full = await qc.fetchQuery({ queryKey: ['activity', a.id], queryFn: () => activitiesApi.get(a.id), staleTime: 0 });
      setDetailId(null); setForm({ type: full.type, activity: full });
    } catch (e) { toast.error(errorMessage(e)); }
  }, [qc, toast]);

  const move = useCallback(async (a: Activity, status: Status) => {
    if (status.id === a.status_id) return;
    if (status.kind === 'done') { setCompleting({ a, statusId: status.id }); return; }
    if (status.kind === 'canceled' && !(await askCancel(a))) return;
    setStatus.mutate({ a, status }, { onSuccess: () => { if (status.kind === 'scheduled' && !a.date) { toast.info('Defina a data e o horário para concluir o agendamento.'); editActivity(a); } } });
  }, [askCancel, setStatus, toast, editActivity]);

  const api = useMemo<Api>(() => ({
    openDetail: setDetailId,
    openForm: (type, defaults, allowTypeChange) => setForm({ type, defaults, allowTypeChange }),
    editActivity,
    complete: (a, statusId) => { setDetailId(null); setCompleting({ a, statusId }); },
    move,
  }), [editActivity, move]);

  return (
    <Ctx.Provider value={api}>
      {children}
      {detailId !== null && (
        <ActivityDetail id={detailId} onClose={() => setDetailId(null)} onEdit={editActivity} onComplete={(a) => api.complete(a)}
          onMove={(a, sid) => { const s = statuses.data?.find((x) => x.id === sid); if (s) { setDetailId(null); move(a, s); } }} />
      )}
      {form && <ActivityForm type={form.type} activity={form.activity} defaults={form.defaults} allowTypeChange={form.allowTypeChange} onClose={() => setForm(null)} />}
      {completing && <CompleteDialog activity={completing.a} statusId={completing.statusId} onClose={() => setCompleting(null)} />}
    </Ctx.Provider>
  );
}
