import { useMutation, useQueryClient } from '@tanstack/react-query';
import { activitiesApi } from '../../api/services';
import type { Activity, Status } from '../../types';
import { ACTIVITY_META } from '../../utils/constants';
import { useToast } from '../../hooks/useToast';
import { useConfirm } from '../../hooks/useConfirm';
import { errorMessage } from '../../utils/errors';

const done = (a: Activity) => `${ACTIVITY_META[a.type].label}`;

/** Ações compartilhadas por Kanban, agenda, listas e modais (status, exclusão). */
export function useActivityActions() {
  const qc = useQueryClient(); const toast = useToast(); const confirm = useConfirm();
  const refresh = () => qc.invalidateQueries();

  const setStatus = useMutation({
    mutationFn: ({ a, status }: { a: Activity; status: Status }) => activitiesApi.setStatus(a.id, status.id),
    // Atualização otimista: o card muda de coluna imediatamente
    onMutate: async ({ a, status }) => {
      await qc.cancelQueries({ queryKey: ['activities'] });
      qc.setQueriesData<Activity[]>({ queryKey: ['activities'] }, (list) =>
        Array.isArray(list) ? list.map((x) => (x.id === a.id ? { ...x, status_id: status.id, status_name: status.name, status_kind: status.kind, status_color: status.color } : x)) : list);
    },
    onSuccess: (r, { status }) => { refresh(); toast.success(`✓ ${done(r)} movida para "${status.name}".`); },
    onError: (e) => { refresh(); toast.error(errorMessage(e)); },
  });
  const remove = useMutation({
    mutationFn: (a: Activity) => activitiesApi.remove(a.id),
    onSuccess: (_r, a) => { refresh(); toast.success(`✓ ${done(a)} excluída.`); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const askDelete = async (a: Activity) => {
    const ok = await confirm({ title: `Excluir ${ACTIVITY_META[a.type].label.toLowerCase()}?`, message: `Deseja realmente excluir "${a.title}"? Esta ação não pode ser desfeita.`, confirmLabel: 'Excluir', danger: true });
    if (ok) await remove.mutateAsync(a);
    return ok;
  };
  const askCancel = (a: Activity) => confirm({ title: 'Cancelar atividade?', message: `Deseja realmente marcar "${a.title}" como cancelada?`, confirmLabel: 'Cancelar atividade', danger: true });

  return { setStatus, remove, askDelete, askCancel, refresh };
}
