import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Building2, CalendarCheck2, CalendarRange, CheckCheck, Star, Plus, BellRing } from 'lucide-react';
import { dashboardApi } from '../api/services';
import type { ActivityType, KindCounts } from '../types';
import { useAuth } from '../hooks/useAuth';
import { ACTIVITY_META, kanbanPath } from '../utils/constants';
import { fmtDateLong, todayISO } from '../utils/date';
import { ActivityItem } from '../components/activities/ActivityCard';
import { useActivityModals } from '../components/activities/ActivityModals';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/Badges';
import { EmptyState, ErrorState, Skeleton } from '../components/ui/States';

function TypeKpi({ type, c }: { type: ActivityType; c: KindCounts }) {
  const m = ACTIVITY_META[type]; const I = m.icon;
  return (
    <Link to={kanbanPath(type)} className="card kpi" style={{ '--type-color': m.color } as CSSProperties}>
      <div className="kpi-label"><I size={16} style={{ color: m.color }} />{m.plural}</div>
      <div className="kpi-value">{c.pending + c.attention}<span className="small muted" style={{ fontWeight: 500 }}> pendentes</span></div>
      <div className="kpi-sub"><span>📅 {c.scheduled} agendad{type === 'installation' ? 'as' : 'os'}</span><span>▶ {c.in_progress} em andamento</span><span>✓ {c.done} conclu{type === 'installation' ? 'ídas' : 'ídos'}</span></div>
    </Link>
  );
}

export default function DashboardPage() {
  const { user } = useAuth(); const modals = useActivityModals();
  const q = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.get, refetchInterval: 60_000 });
  const [tab, setTab] = useState<'all' | ActivityType>('all');
  const d = q.data;
  const upcoming = d ? (tab === 'all' ? d.upcoming : d.upcoming.filter((a) => a.type === tab)) : [];
  const hour = new Date().getHours();

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>{hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'}, {user?.name.split(' ')[0]}</h1><p className="cap-first">{fmtDateLong(todayISO())}</p></div>
        <div className="row row-wrap">
          <Button onClick={() => modals.openForm('installation')}><Plus size={15} /> Instalação</Button>
          <Button onClick={() => modals.openForm('training')}><Plus size={15} /> Treinamento</Button>
          <Button onClick={() => modals.openForm('followup')}><Plus size={15} /> Acompanhamento</Button>
        </div>
      </div>
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.isLoading && <div className="grid grid-kpi">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} h={110} />)}</div>}
      {d && (<div className="col" style={{ gap: 16 }}>
        <div className="grid grid-kpi">
          <Link to="/atrasados" className={`card kpi ${d.kpis.overdue ? 'kpi-danger' : ''}`}><div className="kpi-label"><AlertTriangle size={16} />Atrasadas</div><div className="kpi-value">{d.kpis.overdue}</div><div className="kpi-sub">{d.kpis.overdue ? 'Exigem ação imediata' : 'Tudo em dia ✓'}</div></Link>
          <Link to="/hoje" className="card kpi"><div className="kpi-label"><CalendarCheck2 size={16} />Para hoje</div><div className="kpi-value">{d.kpis.today}</div><div className="kpi-sub">Próximos 7 dias: {d.kpis.next_days}</div></Link>
          <Link to="/clientes" className="card kpi"><div className="kpi-label"><Building2 size={16} />Clientes</div><div className="kpi-value">{d.kpis.clients_total}</div><div className="kpi-sub">{d.kpis.clients_new} novos neste mês</div></Link>
          <Link to="/relatorios" className="card kpi"><div className="kpi-label"><CheckCheck size={16} />Concluídas na semana</div><div className="kpi-value">{d.kpis.done_this_week}</div><div className="kpi-sub">Ver relatório semanal</div></Link>
        </div>
        <div className="grid grid-3"><TypeKpi type="installation" c={d.kpis.installations} /><TypeKpi type="training" c={d.kpis.trainings} /><TypeKpi type="followup" c={d.kpis.followups} /></div>

        <div className="grid grid-main">
          <div className="col" style={{ gap: 16, minWidth: 0 }}>
            {d.overdue.length > 0 && (
              <section className="card" style={{ borderColor: 'color-mix(in srgb, var(--red) 45%, var(--border))' }} aria-label="Atrasados">
                <div className="card-head"><h2 style={{ color: 'var(--red)' }}><AlertTriangle size={16} style={{ verticalAlign: -2 }} /> Atrasados ({d.overdue.length})</h2><Link to="/atrasados">Ver todos</Link></div>
                <div className="alist">{d.overdue.slice(0, 5).map((a) => <ActivityItem key={a.id} a={a} showDate onOpen={() => modals.openDetail(a.id)} />)}</div>
              </section>
            )}
            <section className="card" aria-label="Hoje">
              <div className="card-head"><h2>Hoje</h2><Link to="/hoje">Ver dia completo</Link></div>
              {d.today_list.length === 0 ? <EmptyState icon={CalendarCheck2} title="Nada agendado para hoje." action={<Button variant="primary" onClick={() => modals.openForm('task', { date: todayISO() }, true)}><Plus size={15} /> Novo compromisso</Button>} />
                : <div className="alist">{d.today_list.map((a) => <ActivityItem key={a.id} a={a} onOpen={() => modals.openDetail(a.id)} />)}</div>}
            </section>
            <section className="card" aria-label="Próximos compromissos">
              <div className="card-head"><h2><CalendarRange size={16} style={{ verticalAlign: -2 }} /> Próximos 7 dias</h2>
                <div className="seg" role="group" aria-label="Filtrar por tipo">
                  {(['all', 'installation', 'training', 'followup'] as const).map((t) => <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>{t === 'all' ? 'Tudo' : ACTIVITY_META[t].plural}</button>)}
                </div>
              </div>
              {upcoming.length === 0 ? <EmptyState title="Nenhum compromisso nos próximos dias." /> : <div className="alist">{upcoming.slice(0, 10).map((a) => <ActivityItem key={a.id} a={a} showDate onOpen={() => modals.openDetail(a.id)} />)}</div>}
            </section>
          </div>
          <aside className="col" style={{ gap: 16, minWidth: 0 }}>
            <section className="card" aria-label="Alertas">
              <div className="card-head"><h2><BellRing size={16} style={{ verticalAlign: -2 }} /> Alertas</h2></div>
              <div className="col card-pad" style={{ gap: 8 }}>
                {d.alerts.length === 0 && <p className="muted center" style={{ margin: 12 }}>Sem alertas no momento.</p>}
                {d.alerts.map((al, i) => {
                  const inner = (<><AlertTriangle size={16} style={{ flex: 'none', marginTop: 2 }} aria-hidden /><div><strong>{al.title}</strong><span>{al.message}</span></div></>);
                  if (al.activity_id) return <button key={i} className={`alert-item alert-${al.level}`} style={{ border: 0, textAlign: 'left', cursor: 'pointer' }} onClick={() => modals.openDetail(al.activity_id!)}>{inner}</button>;
                  return <Link key={i} to={`/clientes/${al.client_id}`} className={`alert-item alert-${al.level}`} style={{ textDecoration: 'none' }}>{inner}</Link>;
                })}
              </div>
            </section>
            {d.followup_clients.length > 0 && (
              <section className="card" aria-label="Clientes que precisam de atenção">
                <div className="card-head"><h2>Precisam de acompanhamento</h2></div>
                <div className="alist">{d.followup_clients.slice(0, 5).map((c) => (
                  <div key={c.id} className="aitem" style={{ cursor: 'default' }}><div className="aitem-main"><Link to={`/clientes/${c.id}`} className="aitem-title">{c.name}</Link><div className="aitem-meta">Último contato: {String(c.last_contact).split('-').reverse().join('/')}</div></div>
                    <Button size="sm" onClick={() => modals.openForm('followup', { client_id: c.id })}>Agendar</Button></div>))}</div>
              </section>
            )}
            <section className="card" aria-label="Clientes favoritos">
              <div className="card-head"><h2><Star size={16} className="fav" style={{ verticalAlign: -2 }} /> Clientes importantes</h2></div>
              {d.favorites.length === 0 ? <p className="muted center" style={{ margin: 16 }}>Marque clientes com ★ para acesso rápido.</p>
                : <div className="alist">{d.favorites.map((c) => (<Link key={c.id} to={`/clientes/${c.id}`} className="aitem" style={{ color: 'inherit', textDecoration: 'none' }}><div className="aitem-main"><div className="aitem-title">{c.name}</div><div className="aitem-meta">{c.city}</div></div><StatusBadge kind={c.status_kind} name={c.status_name} /></Link>))}</div>}
            </section>
          </aside>
        </div>
      </div>)}
    </div>
  );
}
