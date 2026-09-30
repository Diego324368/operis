import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../api/services';
import { fmtMinutes } from '../utils/format';
import { addDaysISO, fmtDate, todayISO } from '../utils/date';
import { PeriodPicker, type Period } from '../components/ui/PeriodPicker';
import { BarChart } from '../components/charts/BarChart';
import { ErrorState, ListSkeleton } from '../components/ui/States';
import type { RangeKey } from '../types';

const PRESETS: { key: RangeKey; label: string }[] = [{ key: 'week', label: 'Semana' }, { key: 'month', label: 'Mês' }, { key: 'custom', label: 'Personalizado' }];

export default function ProductivityPage() {
  const [p, setP] = useState<Period>({ preset: 'custom', from: addDaysISO(todayISO(), -29), to: todayISO() });
  const q = useQuery({ queryKey: ['report', 'prod', p.from, p.to], queryFn: () => reportsApi.get({ range: 'custom', from: p.from, to: p.to }), placeholderData: (x) => x });
  const r = q.data;
  const perDay = r?.productivity.by_day.map((d) => ({ label: d.date.slice(8) + '/' + d.date.slice(5, 7), title: fmtDate(d.date), values: { done: d.done } })) ?? [];
  const perWeek = r?.productivity.by_week.map((w) => ({ label: w.week.slice(8) + '/' + w.week.slice(5, 7), title: `Semana de ${fmtDate(w.week)}`, values: { installation: w.installation, training: w.training, followup: w.followup } })) ?? [];
  const total = r?.productivity.by_day.reduce((s, d) => s + d.done, 0) ?? 0;

  return (
    <div className="page">
      <div className="page-header"><div><h1>Produtividade</h1><p>Como o trabalho evoluiu no período escolhido.</p></div></div>
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="row row-wrap">
          <div className="seg" role="group" aria-label="Atalhos">
            <button aria-pressed={false} onClick={() => setP({ preset: 'custom', from: addDaysISO(todayISO(), -6), to: todayISO() })}>7 dias</button>
            <button aria-pressed={false} onClick={() => setP({ preset: 'custom', from: addDaysISO(todayISO(), -29), to: todayISO() })}>30 dias</button>
            <button aria-pressed={false} onClick={() => setP({ preset: 'custom', from: addDaysISO(todayISO(), -89), to: todayISO() })}>90 dias</button>
          </div>
          <PeriodPicker value={p} onChange={setP} presets={PRESETS} />
        </div>
      </div>
      {q.isLoading && <ListSkeleton rows={5} />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {r && (
        <div className="col" style={{ gap: 16, opacity: q.isFetching ? .6 : 1 }}>
          <div className="grid grid-kpi">
            <div className="card kpi"><div className="kpi-label">Taxa de conclusão</div><div className="kpi-value">{r.totals.completion_rate}%</div><div className="kpi-sub">{r.totals.done} de {r.totals.total - r.totals.canceled} atividades</div></div>
            <div className="card kpi"><div className="kpi-label">Atividades concluídas</div><div className="kpi-value">{total}</div><div className="kpi-sub">Média de {(total / Math.max(1, r.productivity.by_day.length)).toFixed(1)} por dia</div></div>
            <div className="card kpi"><div className="kpi-label">Clientes atendidos</div><div className="kpi-value">{r.clients.attended}</div></div>
            <div className={`card kpi ${r.totals.overdue ? 'kpi-danger' : ''}`}><div className="kpi-label">Atrasadas</div><div className="kpi-value">{r.totals.overdue}</div></div>
            <div className="card kpi"><div className="kpi-label">Tempo em atividades</div><div className="kpi-value">{fmtMinutes(r.totals.minutes_done)}</div><div className="kpi-sub">apenas com horário registrado</div></div>
          </div>
          <section className="card card-pad"><h2 style={{ marginBottom: 12 }}>Atividades concluídas por dia</h2>
            {total === 0 ? <p className="muted">Nenhuma atividade concluída neste período.</p> : <BarChart data={perDay} series={[{ key: 'done', label: 'Concluídas', color: 'var(--c-install)' }]} ariaLabel={`Atividades concluídas por dia, total de ${total}`} />}</section>
          <section className="card card-pad"><h2 style={{ marginBottom: 12 }}>Instalações, treinamentos e acompanhamentos por semana</h2>
            {perWeek.length === 0 ? <p className="muted">Sem dados no período.</p> : <BarChart data={perWeek} series={[{ key: 'installation', label: 'Instalações', color: 'var(--c-install)' }, { key: 'training', label: 'Treinamentos', color: 'var(--c-training)' }, { key: 'followup', label: 'Acompanhamentos', color: 'var(--c-followup)' }]} ariaLabel="Concluídos por semana e tipo" />}</section>
        </div>
      )}
    </div>
  );
}
