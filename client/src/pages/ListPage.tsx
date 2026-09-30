import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck2, CheckCircle2, Plus } from 'lucide-react';
import { activitiesApi } from '../api/services';
import type { Activity, ActivityFilter, ActivityType } from '../types';
import { ACTIVITY_META } from '../utils/constants';
import { fmtDateLong, todayISO } from '../utils/date';
import { ActivityItem } from '../components/activities/ActivityCard';
import { FilterBar } from '../components/activities/FilterBar';
import { useActivityModals } from '../components/activities/ActivityModals';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState, ListSkeleton } from '../components/ui/States';

const OPEN = 'pending,scheduled,in_progress,attention';

/** "Hoje" (ordem cronológica) e "Atrasados". */
export default function ListPage({ mode }: { mode: 'today' | 'overdue' }) {
  const modals = useActivityModals();
  const [type, setType] = useState<ActivityType | ''>(''); const [filter, setFilter] = useState<ActivityFilter>({});
  const [showDone, setShowDone] = useState(true);
  const base: ActivityFilter = mode === 'today' ? { range: 'today' } : { overdue: true, kind: OPEN };
  const q = useQuery({ queryKey: ['activities', mode, type, filter], queryFn: () => activitiesApi.list({ ...(mode === 'overdue' ? { ...base, ...filter, kind: OPEN, overdue: true } : { ...filter, ...base }), ...(type ? { type } : {}) }), placeholderData: (p) => p });

  const { open, done, groups } = useMemo(() => {
    const all = q.data ?? [];
    const isDone = (a: Activity) => ['done', 'canceled'].includes(a.status_kind);
    const open = all.filter((a) => !isDone(a)); const done = all.filter(isDone);
    const groups = mode === 'overdue' ? Object.entries(open.reduce<Record<string, Activity[]>>((m, a) => { (m[a.date ?? ''] ??= []).push(a); return m; }, {})).sort(([x], [y]) => x.localeCompare(y)) : [];
    return { open, done, groups };
  }, [q.data, mode]);

  const title = mode === 'today' ? 'Hoje' : 'Atrasados';
  return (
    <div className="page">
      <div className="page-header">
        <div><h1>{title}</h1><p className="cap-first">{mode === 'today' ? fmtDateLong(todayISO()) : 'Atividades que deveriam ter sido concluídas e ainda não foram.'}</p></div>
        {mode === 'today' && <Button variant="primary" onClick={() => modals.openForm('task', { date: todayISO() }, true)}><Plus size={16} /> Novo compromisso</Button>}
      </div>
      <div className="row row-wrap" style={{ marginBottom: 12 }}>
        <div className="seg" role="group" aria-label="Tipo">
          <button aria-pressed={type === ''} onClick={() => setType('')}>Todos</button>
          {(['installation', 'training', 'followup', 'task'] as ActivityType[]).map((t) => <button key={t} aria-pressed={type === t} onClick={() => setType(t)}>{ACTIVITY_META[t].plural}</button>)}
        </div>
      </div>
      {mode === 'overdue' && <FilterBar value={filter} onChange={setFilter} showKind={false} />}
      {q.isLoading && <ListSkeleton rows={5} />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data && (
        <>
          {mode === 'today' && q.data.length > 0 && (
            <div className="stat-row" style={{ marginBottom: 16 }}>
              <div className="stat"><b>{q.data.length}</b><span>compromissos</span></div><div className="stat"><b>{open.length}</b><span>a fazer</span></div>
              <div className="stat"><b>{done.length}</b><span>concluídos</span></div><div className="stat"><b style={{ color: 'var(--red)' }}>{open.filter((a) => a.is_overdue).length}</b><span>com horário vencido</span></div>
            </div>
          )}
          <div className="card">
            {q.data.length === 0 && (mode === 'today'
              ? <EmptyState icon={CalendarCheck2} title="Nada agendado para hoje." text="Aproveite para adiantar tarefas ou agendar acompanhamentos." action={<Button variant="primary" onClick={() => modals.openForm('task', { date: todayISO() }, true)}><Plus size={16} /> Novo compromisso</Button>} />
              : <EmptyState icon={CheckCircle2} title="Nenhuma atividade atrasada." text="Tudo em dia. Bom trabalho!" />)}
            {mode === 'today' && <div className="alist">{open.map((a) => <ActivityItem key={a.id} a={a} onOpen={() => modals.openDetail(a.id)} />)}</div>}
            {mode === 'overdue' && groups.map(([d, items]) => (<div key={d}><div className="group-title">{d ? fmtDateLong(d) : 'Sem data'}</div><div className="alist">{items.map((a) => <ActivityItem key={a.id} a={a} onOpen={() => modals.openDetail(a.id)} />)}</div></div>))}
          </div>
          {mode === 'today' && done.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowDone((s) => !s)}>{showDone ? 'Ocultar' : 'Mostrar'} concluídos ({done.length})</button>
              {showDone && <div className="card" style={{ marginTop: 8, opacity: .85 }}><div className="alist">{done.map((a) => <ActivityItem key={a.id} a={a} onOpen={() => modals.openDetail(a.id)} />)}</div></div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
