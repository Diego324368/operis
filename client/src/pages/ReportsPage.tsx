import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CalendarRange, Download, FileSpreadsheet, FileText, Save, Sparkles } from 'lucide-react';
import { reportsApi } from '../api/services';
import { downloadUrl } from '../api/http';
import type { ActivityType } from '../types';
import { useToast } from '../hooks/useToast';
import { ACTIVITY_META } from '../utils/constants';
import { fmtDate } from '../utils/date';
import { errorMessage } from '../utils/errors';
import { fmtMinutes } from '../utils/format';
import { PeriodPicker, periodOf, type Period } from '../components/ui/PeriodPicker';
import { Button } from '../components/ui/Button';
import { StatusBadge, TypeChip } from '../components/ui/Badges';
import { EmptyState, ErrorState, ListSkeleton } from '../components/ui/States';
import { useActivityModals } from '../components/activities/ActivityModals';

const ORDER: ActivityType[] = ['installation', 'training', 'followup', 'task', 'meeting', 'event'];

export default function ReportsPage() {
  const toast = useToast(); const modals = useActivityModals();
  const [p, setP] = useState<Period>(periodOf('week'));
  const params = { range: 'custom', from: p.from, to: p.to, ...(p.preset === 'week' ? { preset: 'week' } : {}) };
  const q = useQuery({ queryKey: ['report', p.from, p.to], queryFn: () => reportsApi.get(params), placeholderData: (x) => x });
  const save = useMutation({ mutationFn: () => reportsApi.save({ ...params, title: `Relatório ${fmtDate(p.from)} a ${fmtDate(p.to)}` }), onSuccess: () => toast.success('✓ Relatório salvo.'), onError: (e) => toast.error(errorMessage(e)) });
  const exp = (f: string) => downloadUrl(`/reports/export/${f}`, Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])));
  const r = q.data;

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Relatórios</h1><p>Tudo o que foi realizado, pendente e atrasado no período.</p></div>
        <Button variant="primary" onClick={() => setP(periodOf('week'))}><Sparkles size={16} /> Gerar relatório da semana</Button>
      </div>
      <div className="card card-pad row row-wrap between" style={{ marginBottom: 16 }}>
        <PeriodPicker value={p} onChange={setP} />
        <div className="row row-wrap">
          <a className="btn" href={exp('pdf')} download><FileText size={15} /> PDF</a>
          <a className="btn" href={exp('xlsx')} download><FileSpreadsheet size={15} /> Excel</a>
          <a className="btn" href={exp('csv')} download><Download size={15} /> CSV</a>
          <Button loading={save.isPending} onClick={() => save.mutate()}><Save size={15} /> Salvar</Button>
        </div>
      </div>
      {q.isLoading && <ListSkeleton rows={6} />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {r && (
        <div className="col" style={{ gap: 16, opacity: q.isFetching ? .6 : 1, transition: 'opacity .15s' }}>
          <div className="grid grid-kpi">
            {([['Clientes atendidos', r.clients.attended], ['Instalações realizadas', r.by_type.installation.done], ['Treinamentos realizados', r.by_type.training.done], ['Acompanhamentos realizados', r.by_type.followup.done],
              ['Novos clientes', r.clients.new], ['Taxa de conclusão', `${r.totals.completion_rate}%`], ['Pendentes', r.totals.pending], ['Atrasadas', r.totals.overdue]] as [string, string | number][]).map(([k, v]) => (
              <div key={k} className={`card kpi ${k === 'Atrasadas' && r.totals.overdue ? 'kpi-danger' : ''}`}><div className="kpi-label">{k}</div><div className="kpi-value">{v}</div></div>))}
          </div>
          <section className="card">
            <div className="card-head"><h2>Resumo por tipo</h2><span className="muted small">Tempo em atividades concluídas (com horário): <b>{fmtMinutes(r.totals.minutes_done)}</b></span></div>
            <div className="table-wrap"><table className="table"><thead><tr><th>Tipo</th><th>Total</th><th>Concluídas</th><th>Pendentes</th><th>Agendadas</th><th>Em andamento</th><th>Canceladas</th><th>Atrasadas</th></tr></thead>
              <tbody>{ORDER.map((t) => { const s = r.by_type[t]; return (<tr key={t} style={{ cursor: 'default' }}><td><TypeChip type={t} /></td><td>{s.total}</td><td>{s.done}</td><td>{s.pending}</td><td>{s.scheduled}</td><td>{s.in_progress + s.attention}</td><td>{s.canceled}</td><td style={{ color: s.overdue ? 'var(--red)' : undefined, fontWeight: s.overdue ? 700 : 400 }}>{s.overdue}</td></tr>); })}</tbody></table></div>
          </section>
          <section className="card card-pad"><h2 style={{ marginBottom: 12 }}>Clientes</h2>
            <div className="stat-row"><div className="stat"><b>{r.clients.new}</b><span>novos no período</span></div><div className="stat"><b>{r.clients.attended}</b><span>atendidos no período</span></div><div className="stat"><b>{r.clients.active}</b><span>ativos (total)</span></div><div className="stat"><b>{r.clients.finished}</b><span>finalizados (total)</span></div></div></section>
          <section className="card">
            <div className="card-head"><h2><CalendarRange size={16} style={{ verticalAlign: -2 }} /> Atividades do período ({r.activities.length})</h2></div>
            {r.activities.length === 0 ? <EmptyState title="Nenhuma atividade neste período." text="Escolha outro período ou cadastre atividades." /> : (
              <div className="table-wrap" style={{ maxHeight: 460, overflow: 'auto' }}><table className="table"><thead><tr><th>Data</th><th>Hora</th><th>Tipo</th><th>Cliente / título</th><th>Responsável</th><th>Status</th></tr></thead>
                <tbody>{r.activities.map((a) => (<tr key={a.id} onClick={() => modals.openDetail(a.id)}><td>{fmtDate(a.ref_date)}</td><td>{a.start_time ? `${a.start_time}${a.end_time ? `–${a.end_time}` : ''}` : '—'}</td><td><TypeChip type={a.type} /></td><td>{a.client_name ?? a.title}</td><td>{a.assignee_name ?? '—'}</td><td><StatusBadge kind={a.status_kind} name={a.status_name} overdue={a.is_overdue} /></td></tr>))}</tbody></table></div>)}
          </section>
          <section className="card card-pad"><h2 style={{ marginBottom: 10 }}>Observações importantes</h2>
            {r.notes.length === 0 ? <p className="muted" style={{ margin: 0 }}>Sem observações registradas no período.</p> : (
              <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>{r.notes.slice(0, 40).map((n, i) => <li key={i}><b>{fmtDate(n.date)} — {ACTIVITY_META[n.type].label}{n.client ? ` — ${n.client}` : ''}:</b> <span className="muted">{n.text}</span></li>)}</ul>)}
          </section>
        </div>
      )}
    </div>
  );
}
