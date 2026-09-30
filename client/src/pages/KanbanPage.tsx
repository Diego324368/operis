import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { activitiesApi } from '../api/services';
import type { ActivityFilter, ActivityType } from '../types';
import { ACTIVITY_META } from '../utils/constants';
import { useStatuses } from '../hooks/useLookups';
import { KanbanBoard } from '../components/activities/KanbanBoard';
import { FilterBar } from '../components/activities/FilterBar';
import { useActivityModals } from '../components/activities/ActivityModals';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState, ListSkeleton } from '../components/ui/States';

export default function KanbanPage({ type }: { type: ActivityType }) {
  const meta = ACTIVITY_META[type]; const modals = useActivityModals();
  const [filter, setFilter] = useState<ActivityFilter>({});
  const statuses = useStatuses(meta.scope);
  const list = useQuery({ queryKey: ['activities', { type, ...filter }], queryFn: () => activitiesApi.list({ ...filter, type }), placeholderData: (p) => p });
  const filtered = Object.values(filter).some((v) => v !== undefined && v !== '' && v !== false);
  const fem = meta.fem;
  const noun = meta.label.toLowerCase();

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>{meta.plural}</h1><p>Arraste os cards entre as colunas para atualizar o status.</p></div>
        <Button variant="primary" onClick={() => modals.openForm(type)}><Plus size={16} /> {fem ? 'Nova' : 'Novo'} {noun}</Button>
      </div>
      <FilterBar value={filter} onChange={setFilter} />
      {(list.isLoading || statuses.isLoading) && <ListSkeleton rows={5} />}
      {list.isError && <ErrorState error={list.error} onRetry={() => list.refetch()} />}
      {list.data && statuses.data && (list.data.length === 0 && !filtered
        ? <div className="card"><EmptyState title={`Nenhum${fem ? 'a' : ''} ${noun} encontrad${fem ? 'a' : 'o'}.`} text={`Cadastre ${fem ? 'a primeira' : 'o primeiro'} ${noun} para começar a acompanhar.`}
            action={<Button variant="primary" onClick={() => modals.openForm(type)}><Plus size={16} /> {fem ? 'Nova' : 'Novo'} {noun}</Button>} /></div>
        : <>
            {list.data.length === 0 && filtered && <p className="muted">Nenhum resultado para os filtros selecionados.</p>}
            <KanbanBoard type={type} statuses={statuses.data} activities={list.data} />
          </>)}
    </div>
  );
}
