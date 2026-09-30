import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Mail, MapPin, MessageCircle, Pencil, Phone, Plus, Star, Trash2 } from 'lucide-react';
import { clientsApi } from '../api/services';
import { ApiError } from '../api/http';
import type { Activity, Client } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useConfirm } from '../hooks/useConfirm';
import { HISTORY_ICON_TONE } from '../utils/constants';
import { fmtDate, fmtDateTime } from '../utils/date';
import { errorMessage } from '../utils/errors';
import { whatsappLink } from '../utils/format';
import { ClientForm } from '../components/clients/ClientForm';
import { ActivityItem } from '../components/activities/ActivityCard';
import { useActivityModals } from '../components/activities/ActivityModals';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/Badges';
import { Textarea } from '../components/ui/Form';
import { EmptyState, ErrorState, ListSkeleton } from '../components/ui/States';

type Tab = 'resumo' | 'atividades' | 'historico';

/** Etapas do fluxo Cadastro → Instalação → Treinamento → Acompanhamentos, calculadas a partir das atividades (sem estado duplicado). */
function journey(client: Client, acts: Activity[]) {
  const step = (label: string, list: Activity[]) => {
    const done = list.filter((a) => a.status_kind === 'done').length; const open = list.filter((a) => !['done', 'canceled'].includes(a.status_kind)).length;
    return { label, state: open ? 'open' : done ? 'done' : 'none', sub: list.length ? `${done} concluíd${done === 1 ? 'a' : 'as'}${open ? ` · ${open} em aberto` : ''}` : 'Não iniciada' };
  };
  return [
    { label: 'Cadastro', state: 'done', sub: fmtDate(client.created_at.slice(0, 10)) },
    step('Instalação', acts.filter((a) => a.type === 'installation')), step('Treinamento', acts.filter((a) => a.type === 'training')),
    step('Acompanhamentos', acts.filter((a) => a.type === 'followup')),
    { label: 'Conclusão', state: client.status_kind === 'done' ? 'done' : 'none', sub: client.status_kind === 'done' ? client.status_name : 'Em andamento' },
  ];
}

export default function ClientDetailPage() {
  const id = Number(useParams().id); const nav = useNavigate(); const qc = useQueryClient(); const toast = useToast(); const confirm = useConfirm();
  const { isAdmin } = useAuth(); const modals = useActivityModals();
  const [tab, setTab] = useState<Tab>('resumo'); const [edit, setEdit] = useState(false);
  const [note, setNote] = useState(''); const [notes, setNotes] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['clients', 'detail', id], queryFn: () => clientsApi.detail(id), retry: (n, e) => !(e instanceof ApiError && e.status === 404) && n < 2 });
  const done = (msg: string) => () => { qc.invalidateQueries(); toast.success(msg); };
  const fav = useMutation({ mutationFn: (c: Client) => clientsApi.favorite(c.id, !c.is_favorite), onSuccess: () => qc.invalidateQueries(), onError: (e) => toast.error(errorMessage(e)) });
  const addNote = useMutation({ mutationFn: () => clientsApi.addNote(id, note), onSuccess: () => { setNote(''); done('✓ Anotação registrada no histórico.')(); }, onError: (e) => toast.error(errorMessage(e)) });
  const saveNotes = useMutation({
    mutationFn: (c: Client) => clientsApi.update(id, { ...c, notes: notes ?? '', status_id: c.status_id, assignee_id: c.assignee_id, force: true }),
    onSuccess: () => { setNotes(null); done('✓ Observações salvas.')(); }, onError: (e) => toast.error(errorMessage(e)),
  });
  const del = useMutation({ mutationFn: () => clientsApi.remove(id), onSuccess: () => { nav('/clientes'); qc.removeQueries({ queryKey: ['clients', 'detail', id] }); qc.invalidateQueries(); toast.success('✓ Cliente excluído.'); }, onError: (e) => toast.error(errorMessage(e)) });

  if (q.isLoading) return <div className="page"><ListSkeleton rows={5} /></div>;
  if (q.isError) return <div className="page"><Link to="/clientes"><ArrowLeft size={14} /> Clientes</Link><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>;
  const { client: c, activities, history } = q.data!;
  const openActs = activities.filter((a) => !['done', 'canceled'].includes(a.status_kind));
  const remove = async () => { if (await confirm({ title: 'Excluir cliente?', message: `Deseja realmente excluir "${c.name}"? Todo o histórico e as atividades deste cliente serão excluídos.`, confirmLabel: 'Excluir cliente', danger: true })) del.mutate(); };

  return (
    <div className="page">
      <Link to="/clientes" className="small"><ArrowLeft size={13} style={{ verticalAlign: -2 }} /> Clientes</Link>
      <div className="page-header" style={{ marginTop: 8 }}>
        <div>
          <div className="row" style={{ gap: 10 }}><h1>{c.name}</h1>
            <button className="icon-btn" aria-label={c.is_favorite ? 'Remover dos importantes' : 'Marcar como importante'} aria-pressed={c.is_favorite} onClick={() => fav.mutate(c)}><Star size={20} className={c.is_favorite ? 'fav' : ''} fill={c.is_favorite ? 'currentColor' : 'none'} /></button></div>
          <div className="row row-wrap" style={{ marginTop: 6 }}><StatusBadge kind={c.status_kind} name={c.status_name} />{c.trade_name && <span className="muted">{c.trade_name}</span>}{c.city && <span className="muted row" style={{ gap: 3 }}><MapPin size={13} />{c.city}</span>}</div>
        </div>
        <div className="row row-wrap">
          <Button onClick={() => setEdit(true)}><Pencil size={15} /> Editar</Button>
          {isAdmin && <Button variant="danger" onClick={remove}><Trash2 size={15} /></Button>}
        </div>
      </div>

      <div className="row row-wrap" style={{ marginBottom: 16 }}>
        <Button variant="primary" size="sm" onClick={() => modals.openForm('installation', { client_id: id })}><Plus size={14} /> Instalação</Button>
        <Button size="sm" onClick={() => modals.openForm('training', { client_id: id })}><Plus size={14} /> Treinamento</Button>
        <Button size="sm" onClick={() => modals.openForm('followup', { client_id: id })}><Plus size={14} /> Acompanhamento</Button>
        <Button size="sm" onClick={() => modals.openForm('task', { client_id: id })}><Plus size={14} /> Tarefa</Button>
        <span className="spacer" />
        {c.phone && <a className="btn btn-sm" href={`tel:${c.phone}`}><Phone size={14} /> Ligar</a>}
        {(c.whatsapp || c.phone) && <a className="btn btn-sm" href={whatsappLink((c.whatsapp ?? c.phone)!)} target="_blank" rel="noreferrer"><MessageCircle size={14} /> WhatsApp</a>}
        {c.email && <a className="btn btn-sm" href={`mailto:${c.email}`}><Mail size={14} /> E-mail</a>}
      </div>

      <div className="tabs" role="tablist">
        {([['resumo', 'Resumo'], ['atividades', `Atividades (${activities.length})`], ['historico', `Histórico (${history.length})`]] as [Tab, string][]).map(([k, l]) => <button key={k} className="tab" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {tab === 'resumo' && (
        <div className="grid grid-main">
          <div className="col" style={{ gap: 16, minWidth: 0 }}>
            <section className="card card-pad" aria-label="Jornada do cliente">
              <h2 style={{ marginBottom: 12 }}>Jornada</h2>
              <div className="journey">{journey(c, activities).map((s, i) => (<div key={i} className={`jstep ${s.state}`}><div className="bold row" style={{ gap: 4 }}>{s.state === 'done' && <Check size={14} />}{s.label}</div><div className="tiny muted">{s.sub}</div></div>))}</div>
            </section>
            <section className="card" aria-label="Em aberto">
              <div className="card-head"><h2>Em aberto ({openActs.length})</h2></div>
              {openActs.length === 0 ? <EmptyState title="Nenhuma atividade em aberto." action={<Button variant="primary" onClick={() => modals.openForm('followup', { client_id: id })}><Plus size={15} /> Agendar acompanhamento</Button>} />
                : <div className="alist">{openActs.map((a) => <ActivityItem key={a.id} a={a} showDate onOpen={() => modals.openDetail(a.id)} />)}</div>}
            </section>
          </div>
          <div className="col" style={{ gap: 16, minWidth: 0 }}>
            <section className="card card-pad" aria-label="Observações rápidas">
              <div className="row between" style={{ marginBottom: 8 }}><h2>Observações rápidas</h2>{notes === null && <Button size="sm" variant="ghost" onClick={() => setNotes(c.notes ?? '')}><Pencil size={13} /> Editar</Button>}</div>
              {notes === null ? (c.notes ? <div className="notes-box">{c.notes}</div> : <p className="muted" style={{ margin: 0 }}>Nenhuma observação. Ex.: “prefere atendimento pela manhã”.</p>)
                : <div className="col"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} autoFocus /><div className="row" style={{ justifyContent: 'flex-end' }}><Button size="sm" variant="ghost" onClick={() => setNotes(null)}>Cancelar</Button><Button size="sm" variant="primary" loading={saveNotes.isPending} onClick={() => saveNotes.mutate(c)}>Salvar</Button></div></div>}
            </section>
            <section className="card card-pad" aria-label="Dados do cliente">
              <h2 style={{ marginBottom: 12 }}>Dados</h2>
              <dl className="info-grid" style={{ margin: 0, gridTemplateColumns: '1fr 1fr' }}>
                {([['Responsável', c.contact_name], ['Telefone', c.phone], ['WhatsApp', c.whatsapp], ['E-mail', c.email], ['Endereço', c.address], ['Atendimento', c.assignee_name], ['Cadastro', fmtDate(c.created_at.slice(0, 10))], ['Instalação', fmtDate(c.installation_date)], ['Treinamento', fmtDate(c.training_date)], ['Último acomp.', fmtDate(c.last_followup)], ['Próx. acomp.', fmtDate(c.next_followup)]] as [string, string | null][]).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || '—'}</dd></div>)}
              </dl>
            </section>
          </div>
        </div>
      )}

      {tab === 'atividades' && (
        <div className="card">{activities.length === 0 ? <EmptyState title="Nenhuma atividade para este cliente." action={<Button variant="primary" onClick={() => modals.openForm('installation', { client_id: id })}><Plus size={15} /> Nova instalação</Button>} />
          : <div className="alist">{activities.map((a) => <ActivityItem key={a.id} a={a} showDate onOpen={() => modals.openDetail(a.id)} />)}</div>}</div>
      )}

      {tab === 'historico' && (
        <div className="card card-pad">
          <form className="row" style={{ marginBottom: 18 }} onSubmit={(e) => { e.preventDefault(); if (note.trim()) addNote.mutate(); }}>
            <input className="input" placeholder="Registrar anotação no histórico (ex.: cliente ligou pedindo retorno)…" aria-label="Nova anotação" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
            <Button variant="primary" type="submit" disabled={!note.trim()} loading={addNote.isPending}>Adicionar</Button>
          </form>
          {history.length === 0 ? <EmptyState title="Sem histórico ainda." /> : (
            <ol className="timeline">{history.map((h) => (
              <li key={h.id} className="tl-item">
                <span className={`tl-dot tone-${HISTORY_ICON_TONE[h.event_type] ?? 'gray'}`}><span className="dot" style={{ background: 'currentColor' }} /></span>
                <div className="bold">{h.description}</div>
                <div className="tiny muted">{fmtDateTime(h.occurred_at)}{h.user_name ? ` · ${h.user_name}` : ''}</div>
                {h.details?.note && <div className="small" style={{ marginTop: 3 }}>“{h.details.note}”</div>}
                {h.activity_id && <button className="btn btn-ghost btn-sm" style={{ padding: 0, height: 22 }} onClick={() => modals.openDetail(h.activity_id!)}>Ver atividade</button>}
              </li>))}</ol>)}
        </div>
      )}
      {edit && <ClientForm client={c} onClose={() => setEdit(false)} />}
    </div>
  );
}
