import { useState, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { activitiesApi } from '../api/services';
import type { Activity, ActivityType } from '../types';
import { ACTIVITY_META, ACTIVITY_TYPES_ORDER } from '../utils/constants';
import { fmtDateLong, fmtMonthYear, fromISO, ISO, todayISO, toISO } from '../utils/date';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useActivityModals } from '../components/activities/ActivityModals';
import { ActivityItem } from '../components/activities/ActivityCard';
import { TimeGrid } from '../components/agenda/TimeGrid';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState, ListSkeleton } from '../components/ui/States';

type View = 'day' | 'week' | 'month';
const DOW = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export default function AgendaPage() {
  const modals = useActivityModals(); const isMobile = useMediaQuery('(max-width: 860px)');
  const [view, setView] = useState<View>('week'); const [cursor, setCursor] = useState(todayISO()); const [sel, setSel] = useState(todayISO());
  const [hidden, setHidden] = useState<Set<ActivityType>>(new Set());
  const cur = fromISO(cursor);
  const range = view === 'day' ? [cur, cur] : view === 'week' ? [startOfWeek(cur, { weekStartsOn: 1 }), endOfWeek(cur, { weekStartsOn: 1 })]
    : [startOfWeek(startOfMonth(cur), { weekStartsOn: 1 }), endOfWeek(endOfMonth(cur), { weekStartsOn: 1 })];
  const from = toISO(range[0]); const to = toISO(range[1]);
  const q = useQuery({ queryKey: ['activities', 'agenda', from, to], queryFn: () => activitiesApi.list({ from, to }), placeholderData: (p) => p });
  const events = (q.data ?? []).filter((a) => a.status_kind !== 'canceled' && !hidden.has(a.type));
  const days = eachDayOfInterval({ start: range[0], end: range[1] }).map(toISO);

  const move = (n: number) => setCursor(toISO(view === 'month' ? addMonths(cur, n) : addDays(cur, n * (view === 'week' ? 7 : 1))));
  const title = view === 'month' ? fmtMonthYear(cursor) : view === 'day' ? fmtDateLong(cursor) : `${format(range[0], 'dd/MM')} – ${format(range[1], 'dd/MM/yyyy')}`;
  const create = (date: string, time?: string) => modals.openForm('task', { date, start_time: time ?? null }, true);
  const toggleType = (t: ActivityType) => setHidden((s) => { const n = new Set(s); n.has(t) ? n.delete(t) : n.add(t); return n; });
  const byDay = (d: string) => events.filter((e) => e.date === d);
  const open = (a: Activity) => modals.openDetail(a.id);

  const DayList = ({ date }: { date: string }) => { const l = byDay(date); return l.length === 0
    ? <EmptyState title="Nenhum compromisso neste dia." action={<Button variant="primary" onClick={() => create(date)}><Plus size={15} /> Novo compromisso</Button>} />
    : <div className="alist">{l.map((a) => <ActivityItem key={a.id} a={a} onOpen={() => open(a)} />)}</div>; };

  return (
    <div className="page">
      <div className="page-header"><div><h1>Agenda</h1><p>Instalações, treinamentos, acompanhamentos, reuniões e tarefas com horário.</p></div>
        <Button variant="primary" onClick={() => create(sel)}><Plus size={16} /> Novo evento</Button></div>
      <div className="cal-head">
        <Button size="sm" onClick={() => { setCursor(todayISO()); setSel(todayISO()); }}>Hoje</Button>
        <button className="icon-btn" aria-label="Anterior" onClick={() => move(-1)}><ChevronLeft size={20} /></button>
        <button className="icon-btn" aria-label="Próximo" onClick={() => move(1)}><ChevronRight size={20} /></button>
        <span className="cal-title" aria-live="polite">{title}</span><span className="spacer" />
        <div className="seg" role="group" aria-label="Visão">{([['day', 'Dia'], ['week', 'Semana'], ['month', 'Mês']] as [View, string][]).map(([v, l]) => <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>{l}</button>)}</div>
      </div>
      <div className="row row-wrap" style={{ marginBottom: 12 }} role="group" aria-label="Tipos exibidos">
        {ACTIVITY_TYPES_ORDER.map((t) => { const m = ACTIVITY_META[t]; const off = hidden.has(t); return (
          <button key={t} className="btn btn-sm" aria-pressed={!off} onClick={() => toggleType(t)} style={{ opacity: off ? .45 : 1, '--type-color': m.color } as CSSProperties}><i className="dot" style={{ background: m.color }} />{m.plural}</button>); })}
      </div>
      {q.isLoading && <ListSkeleton rows={6} />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data && view === 'day' && (isMobile ? <div className="card"><DayList date={cursor} /></div> : <TimeGrid days={[cursor]} events={events} onOpen={open} onCreate={create} />)}
      {q.data && view === 'week' && (isMobile
        ? <div className="col" style={{ gap: 12 }}>{days.map((d) => <div key={d} className="card"><div className="group-title row between"><span className="cap-first">{fmtDateLong(d)}{d === todayISO() ? ' · hoje' : ''}</span><button className="icon-btn" style={{ width: 26, height: 26 }} aria-label={`Novo em ${d}`} onClick={() => create(d)}><Plus size={14} /></button></div>{byDay(d).length ? <div className="alist">{byDay(d).map((a) => <ActivityItem key={a.id} a={a} onOpen={() => open(a)} />)}</div> : <p className="muted small" style={{ margin: 12 }}>Livre</p>}</div>)}</div>
        : <TimeGrid days={days} events={events} onOpen={open} onCreate={create} />)}
      {q.data && view === 'month' && (
        <>
          <div className="month" role="grid" aria-label={title}>
            {DOW.map((d) => <div key={d} className="month-dow" role="columnheader">{d}</div>)}
            {days.map((d) => { const l = byDay(d); const dt = fromISO(d);
              return (
                <div key={d} role="gridcell" tabIndex={0} className={`month-cell ${isSameMonth(dt, cur) ? '' : 'out'} ${d === todayISO() ? 'today' : ''} ${d === sel ? 'sel' : ''}`} onClick={() => setSel(d)} onDoubleClick={() => create(d)} onKeyDown={(e) => { if (e.key === 'Enter') setSel(d); }} aria-label={`${format(dt, ISO)}: ${l.length} compromissos`}>
                  <span className="dnum">{format(dt, 'd')}</span>
                  {l.slice(0, 3).map((a) => <button key={a.id} className={`ev-chip ${a.status_kind === 'done' ? 'done' : ''}`} style={{ '--type-color': ACTIVITY_META[a.type].color } as CSSProperties} onClick={(e) => { e.stopPropagation(); open(a); }}>{a.start_time ? `${a.start_time} ` : ''}{a.title}</button>)}
                  {l.length > 3 && <span className="ev-more">+{l.length - 3} mais</span>}
                  <span className="mdots">{l.slice(0, 4).map((a) => <i key={a.id} style={{ '--type-color': ACTIVITY_META[a.type].color } as CSSProperties} />)}</span>
                </div>); })}
          </div>
          <section className="card" style={{ marginTop: 16 }} aria-label="Dia selecionado">
            <div className="card-head"><h2 className="cap-first">{fmtDateLong(sel)}</h2><Button size="sm" variant="primary" onClick={() => create(sel)}><Plus size={14} /> Novo neste dia</Button></div>
            <DayList date={sel} />
          </section>
        </>
      )}
    </div>
  );
}
