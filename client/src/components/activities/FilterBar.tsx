import { Search } from 'lucide-react';
import type { ActivityFilter, RangeKey, StatusKind } from '../../types';
import { RANGE_OPTIONS } from '../../utils/date';
import { useCities, useUsers } from '../../hooks/useLookups';
import { KIND_META } from '../../utils/constants';

interface Props { value: ActivityFilter; onChange: (f: ActivityFilter) => void; showKind?: boolean; showStatusKinds?: boolean }

/** Barra de filtros: busca, período (com personalizado), status, prioridade, cidade e responsável. */
export function FilterBar({ value: f, onChange, showKind = true }: Props) {
  const cities = useCities(); const users = useUsers();
  const set = (p: Partial<ActivityFilter>) => onChange({ ...f, ...p });
  return (
    <div className="filters" role="search" aria-label="Filtros">
      <div className="search-input"><Search size={16} aria-hidden /><input className="input" placeholder="Buscar cliente, telefone, cidade…" aria-label="Buscar" value={f.q ?? ''} onChange={(e) => set({ q: e.target.value })} /></div>
      <select className="select" aria-label="Período" value={f.range ?? ''} onChange={(e) => set({ range: (e.target.value || undefined) as RangeKey | undefined, from: undefined, to: undefined })}>
        {RANGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {f.range === 'custom' && (<>
        <input className="input" type="date" aria-label="De" value={f.from ?? ''} onChange={(e) => set({ from: e.target.value })} />
        <input className="input" type="date" aria-label="Até" value={f.to ?? ''} min={f.from} onChange={(e) => set({ to: e.target.value })} />
      </>)}
      {showKind && (
        <select className="select" aria-label="Situação" value={f.overdue ? 'overdue' : f.kind ?? ''} onChange={(e) => set(e.target.value === 'overdue' ? { overdue: true, kind: undefined } : { kind: e.target.value || undefined, overdue: undefined })}>
          <option value="">Todas as situações</option><option value="overdue">Atrasadas</option>
          {(Object.keys(KIND_META) as StatusKind[]).map((k) => <option key={k} value={k}>{KIND_META[k].label}</option>)}
        </select>
      )}
      <select className="select" aria-label="Prioridade" value={f.priority ?? ''} onChange={(e) => set({ priority: e.target.value || undefined })}>
        <option value="">Toda prioridade</option><option value="high">🔴 Alta</option><option value="medium">🟡 Média</option><option value="low">🟢 Baixa</option>
      </select>
      <select className="select" aria-label="Cidade" value={f.city ?? ''} onChange={(e) => set({ city: e.target.value || undefined })}>
        <option value="">Todas as cidades</option>{cities.data?.map((c) => <option key={c}>{c}</option>)}
      </select>
      <select className="select" aria-label="Responsável" value={f.assignee_id ?? ''} onChange={(e) => set({ assignee_id: e.target.value ? Number(e.target.value) : undefined })}>
        <option value="">Todos os responsáveis</option>{users.data?.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
      {Object.values(f).some((v) => v !== undefined && v !== '' && v !== false) && <button className="btn btn-ghost btn-sm" onClick={() => onChange({})}>Limpar filtros</button>}
    </div>
  );
}
