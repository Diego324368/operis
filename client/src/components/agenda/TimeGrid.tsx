import type { CSSProperties } from 'react';
import type { Activity } from '../../types';
import { ACTIVITY_META } from '../../utils/constants';
import { fmtDateShort, todayISO } from '../../utils/date';

const START = 6, END = 22, HOUR_PX = 56;
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Distribui eventos sobrepostos em "faixas" lado a lado. */
function layout(events: Activity[]) {
  const sorted = [...events].sort((a, b) => a.start_time!.localeCompare(b.start_time!));
  const lanes: number[] = []; const out: { a: Activity; lane: number; total: number; start: number; end: number }[] = [];
  let group: typeof out = [];
  const flush = () => { const t = Math.max(1, ...group.map((g) => g.lane + 1)); group.forEach((g) => (g.total = t)); out.push(...group); group = []; lanes.length = 0; };
  let groupEnd = -1;
  for (const a of sorted) {
    const s = toMin(a.start_time!); const e = Math.max(a.end_time ? toMin(a.end_time) : s + 60, s + 20);
    if (s >= groupEnd && group.length) flush();
    let lane = lanes.findIndex((end) => end <= s); if (lane === -1) { lane = lanes.length; lanes.push(e); } else lanes[lane] = e;
    group.push({ a, lane, total: 1, start: s, end: e }); groupEnd = Math.max(groupEnd, e);
  }
  flush();
  return out;
}

interface Props { days: string[]; events: Activity[]; onOpen: (a: Activity) => void; onCreate: (date: string, time?: string) => void }

export function TimeGrid({ days, events, onOpen, onCreate }: Props) {
  const today = todayISO();
  const hours = Array.from({ length: END - START }, (_, i) => START + i);
  const now = new Date(); const nowTop = ((now.getHours() * 60 + now.getMinutes()) - START * 60) * HOUR_PX / 60;
  const chip = (a: Activity) => { const m = ACTIVITY_META[a.type]; return (
    <button key={a.id} className={`ev-chip ${a.status_kind === 'done' ? 'done' : ''}`} style={{ '--type-color': m.color } as CSSProperties} onClick={() => onOpen(a)} title={a.title}>{a.title}</button>); };
  return (
    <div className="tgrid" style={{ '--cols': days.length } as CSSProperties}>
      <div className="tg-head" style={{ position: 'sticky', left: 0 }} />
      {days.map((d) => <div key={d} className={`tg-head ${d === today ? 'today' : ''}`} style={{ textTransform: 'capitalize' }}>{fmtDateShort(d)}</div>)}
      <div className="tiny muted" style={{ padding: '4px 2px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>s/ hora</div>
      {days.map((d) => <div key={d} style={{ borderLeft: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: 3, display: 'flex', flexDirection: 'column', gap: 2, minHeight: 28 }}>{events.filter((e) => e.date === d && !e.start_time).map(chip)}</div>)}
      <div className="tg-hours">{hours.map((h) => <div key={h} className="tg-hour">{String(h).padStart(2, '0')}:00</div>)}</div>
      {days.map((d) => (
        <div key={d} className="tg-col" style={{ height: (END - START) * HOUR_PX }} role="button" tabIndex={-1} aria-label={`Criar em ${d}`}
          onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); const min = Math.round(((e.clientY - r.top) / HOUR_PX) * 60 / 30) * 30 + START * 60; onCreate(d, `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`); }}>
          {d === today && nowTop > 0 && nowTop < (END - START) * HOUR_PX && <div className="tg-now" style={{ top: nowTop }} aria-hidden />}
          {layout(events.filter((e) => e.date === d && e.start_time)).map(({ a, lane, total, start, end }) => {
            const m = ACTIVITY_META[a.type]; const top = (Math.max(start, START * 60) - START * 60) * HOUR_PX / 60; const h = Math.max((Math.min(end, END * 60) - Math.max(start, START * 60)) * HOUR_PX / 60, 22);
            return (
              <button key={a.id} className={`tg-ev ${a.status_kind === 'done' ? 'done' : ''}`} onClick={(e) => { e.stopPropagation(); onOpen(a); }}
                style={{ '--type-color': m.color, top, height: h, left: `calc(${(lane / total) * 100}% + 1px)`, width: `calc(${100 / total}% - 3px)` } as CSSProperties} title={`${a.start_time} ${a.title}`}>
                <b>{a.start_time}</b> {a.title}{h > 40 && a.client_name && !a.title.includes(a.client_name) && <div className="tiny muted truncate">{a.client_name}</div>}
              </button>);
          })}
        </div>
      ))}
    </div>
  );
}
