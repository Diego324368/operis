import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Building2, MessageCircle, Plus, Search, Star, Trash2, Pencil } from 'lucide-react';
import { clientsApi } from '../api/services';
import type { Client } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useCities, useStatuses, useUsers } from '../hooks/useLookups';
import { useDebounce } from '../hooks/useDebounce';
import { useToast } from '../hooks/useToast';
import { useConfirm } from '../hooks/useConfirm';
import { fmtDate } from '../utils/date';
import { errorMessage } from '../utils/errors';
import { whatsappLink } from '../utils/format';
import { ClientForm } from '../components/clients/ClientForm';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/Badges';
import { EmptyState, ErrorState, ListSkeleton } from '../components/ui/States';

const PAGE = 25;
export default function ClientsPage() {
  const nav = useNavigate(); const qc = useQueryClient(); const toast = useToast(); const confirm = useConfirm(); const { isAdmin } = useAuth();
  const [text, setText] = useState(''); const q = useDebounce(text);
  const [f, setF] = useState<{ status_id?: number; city?: string; assignee_id?: number; favorite?: boolean }>({});
  const [sort, setSort] = useState('name'); const [order, setOrder] = useState<'asc' | 'desc'>('asc'); const [page, setPage] = useState(1);
  const [form, setForm] = useState<{ client?: Client } | null>(null);
  const statuses = useStatuses('client'); const cities = useCities(); const users = useUsers();
  const list = useQuery({ queryKey: ['clients', { q, ...f, sort, order, page }], queryFn: () => clientsApi.list({ q, ...f, sort, order, page, page_size: PAGE }), placeholderData: (p) => p });
  const fav = useMutation({ mutationFn: (c: Client) => clientsApi.favorite(c.id, !c.is_favorite), onSuccess: () => qc.invalidateQueries(), onError: (e) => toast.error(errorMessage(e)) });
  const del = useMutation({ mutationFn: (c: Client) => clientsApi.remove(c.id), onSuccess: () => { qc.invalidateQueries(); toast.success('✓ Cliente excluído.'); }, onError: (e) => toast.error(errorMessage(e)) });
  const remove = async (c: Client) => { if (await confirm({ title: 'Excluir cliente?', message: `Deseja realmente excluir "${c.name}"? Todo o histórico, instalações, treinamentos e acompanhamentos deste cliente também serão excluídos.`, confirmLabel: 'Excluir cliente', danger: true })) del.mutate(c); };
  const sortBy = (k: string) => { if (sort === k) setOrder((o) => (o === 'asc' ? 'desc' : 'asc')); else { setSort(k); setOrder('asc'); } setPage(1); };
  const th = (k: string, label: string) => <th aria-sort={sort === k ? (order === 'asc' ? 'ascending' : 'descending') : 'none'}><button onClick={() => sortBy(k)}>{label}{sort === k && (order === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}</button></th>;
  const setFilter = (p: Partial<typeof f>) => { setF((s) => ({ ...s, ...p })); setPage(1); };
  const total = list.data?.total ?? 0; const pages = Math.max(1, Math.ceil(total / PAGE));
  const filtered = !!(q || f.status_id || f.city || f.assignee_id || f.favorite);

  const Actions = ({ c }: { c: Client }) => (
    <div className="row" style={{ gap: 2 }} onClick={(e) => e.stopPropagation()}>
      <button className="icon-btn" aria-label={c.is_favorite ? 'Remover dos importantes' : 'Marcar como importante'} aria-pressed={c.is_favorite} onClick={() => fav.mutate(c)}><Star size={17} className={c.is_favorite ? 'fav' : ''} fill={c.is_favorite ? 'currentColor' : 'none'} /></button>
      {c.whatsapp && <a className="icon-btn" href={whatsappLink(c.whatsapp)} target="_blank" rel="noreferrer" aria-label={`WhatsApp de ${c.name}`}><MessageCircle size={17} /></a>}
      <button className="icon-btn" aria-label={`Editar ${c.name}`} onClick={() => setForm({ client: c })}><Pencil size={16} /></button>
      {isAdmin && <button className="icon-btn" aria-label={`Excluir ${c.name}`} onClick={() => remove(c)}><Trash2 size={16} /></button>}
    </div>
  );

  return (
    <div className="page">
      <div className="page-header"><div><h1>Clientes</h1><p>{total} cliente{total === 1 ? '' : 's'} {filtered ? 'encontrados' : 'cadastrados'}</p></div><Button variant="primary" onClick={() => setForm({})}><Plus size={16} /> Novo cliente</Button></div>
      <div className="filters" role="search">
        <div className="search-input"><Search size={16} aria-hidden /><input className="input" aria-label="Buscar cliente" placeholder="Nome, telefone, cidade, e-mail…" value={text} onChange={(e) => { setText(e.target.value); setPage(1); }} /></div>
        <select className="select" aria-label="Status" value={f.status_id ?? ''} onChange={(e) => setFilter({ status_id: e.target.value ? Number(e.target.value) : undefined })}><option value="">Todos os status</option>{statuses.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <select className="select" aria-label="Cidade" value={f.city ?? ''} onChange={(e) => setFilter({ city: e.target.value || undefined })}><option value="">Todas as cidades</option>{cities.data?.map((c) => <option key={c}>{c}</option>)}</select>
        <select className="select" aria-label="Responsável" value={f.assignee_id ?? ''} onChange={(e) => setFilter({ assignee_id: e.target.value ? Number(e.target.value) : undefined })}><option value="">Todos os responsáveis</option>{users.data?.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
        <button className={`btn ${f.favorite ? 'btn-primary' : ''}`} aria-pressed={!!f.favorite} onClick={() => setFilter({ favorite: !f.favorite })}><Star size={15} /> Importantes</button>
      </div>
      {list.isLoading && <div className="card"><ListSkeleton rows={6} /></div>}
      {list.isError && <ErrorState error={list.error} onRetry={() => list.refetch()} />}
      {list.data && (list.data.items.length === 0
        ? <div className="card"><EmptyState icon={Building2} title="Nenhum cliente encontrado." text={filtered ? 'Tente ajustar a busca ou os filtros.' : 'Cadastre seu primeiro cliente para começar.'} action={<Button variant="primary" onClick={() => setForm({})}><Plus size={16} /> Novo cliente</Button>} /></div>
        : <>
          <div className="card table-wrap hide-mobile">
            <table className="table">
              <thead><tr>{th('name', 'Cliente')}{th('city', 'Cidade')}<th>Contato</th>{th('status', 'Status')}{th('installation_date', 'Instalação')}{th('training_date', 'Treinamento')}<th>Últ. acomp.</th>{th('next_followup', 'Próx. acomp.')}<th><span className="sr-only">Ações</span></th></tr></thead>
              <tbody>{list.data.items.map((c) => (
                <tr key={c.id} onClick={() => nav(`/clientes/${c.id}`)}>
                  <td><Link to={`/clientes/${c.id}`} onClick={(e) => e.stopPropagation()} className="bold">{c.is_favorite && <Star size={13} className="fav" fill="currentColor" aria-label="Importante" />} {c.name}</Link>{c.trade_name && <div className="tiny muted">{c.trade_name}</div>}</td>
                  <td>{c.city ?? '—'}</td><td>{c.contact_name ?? '—'}<div className="tiny muted">{c.whatsapp ?? c.phone}</div></td>
                  <td><StatusBadge kind={c.status_kind} name={c.status_name} /></td><td>{fmtDate(c.installation_date)}</td><td>{fmtDate(c.training_date)}</td><td>{fmtDate(c.last_followup)}</td><td>{fmtDate(c.next_followup)}</td>
                  <td><Actions c={c} /></td>
                </tr>))}</tbody>
            </table>
          </div>
          <div className="client-cards">{list.data.items.map((c) => (
            <div key={c.id} className="card card-pad" onClick={() => nav(`/clientes/${c.id}`)} role="link" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && nav(`/clientes/${c.id}`)}>
              <div className="row between"><b>{c.name}</b><StatusBadge kind={c.status_kind} name={c.status_name} /></div>
              <div className="muted small">{[c.city, c.contact_name].filter(Boolean).join(' · ')}</div>
              <div className="small" style={{ margin: '6px 0' }}>Instalação: {fmtDate(c.installation_date)} · Treinamento: {fmtDate(c.training_date)}<br />Próx. acompanhamento: {fmtDate(c.next_followup)}</div>
              <Actions c={c} />
            </div>))}</div>
          <div className="row between" style={{ marginTop: 14 }}>
            <span className="muted small">Página {list.data.page} de {pages}</span>
            <div className="row"><Button size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button><Button size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Próxima</Button></div>
          </div>
        </>)}
      {form && <ClientForm client={form.client} onClose={() => setForm(null)} onSaved={(c) => { if (!form.client) nav(`/clientes/${c.id}`); }} />}
    </div>
  );
}
