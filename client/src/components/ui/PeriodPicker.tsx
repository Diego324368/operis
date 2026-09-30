import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, differenceInCalendarDays, parseISO } from 'date-fns';
import { fmtDate, monthShift, rangeToDates, toISO } from '../../utils/date';
import type { RangeKey } from '../../types';

export interface Period { preset: RangeKey; from: string; to: string }
export const periodOf = (preset: RangeKey, from?: string, to?: string): Period => ({ preset, ...rangeToDates(preset, from, to) });

const PRESETS: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Dia' }, { key: 'week', label: 'Semana' }, { key: 'month', label: 'Mês' }, { key: 'custom', label: 'Personalizado' },
];

/** Seletor de período (dia, semana, mês, personalizado) com navegação anterior/próximo. */
export function PeriodPicker({ value, onChange, presets = PRESETS }: { value: Period; onChange: (p: Period) => void; presets?: { key: RangeKey; label: string }[] }) {
  const shift = (dir: 1 | -1) => {
    const { preset, from, to } = value;
    if (preset === 'month' || preset === 'last_month') { const f = monthShift(from, dir); const last = toISO(addDays(parseISO(monthShift(f, 1)), -1)); onChange({ preset: 'month', from: f, to: last }); return; }
    const len = preset === 'today' ? 1 : preset === 'week' ? 7 : differenceInCalendarDays(parseISO(to), parseISO(from)) + 1;
    onChange({ preset, from: toISO(addDays(parseISO(from), dir * len)), to: toISO(addDays(parseISO(to), dir * len)) });
  };
  return (
    <div className="row row-wrap">
      <div className="seg" role="group" aria-label="Período">{presets.map((p) => <button key={p.key} aria-pressed={value.preset === p.key} onClick={() => onChange(periodOf(p.key, value.from, value.to))}>{p.label}</button>)}</div>
      {value.preset !== 'custom' ? (
        <div className="row" style={{ gap: 2 }}>
          <button className="icon-btn" aria-label="Período anterior" onClick={() => shift(-1)}><ChevronLeft size={18} /></button>
          <b style={{ minWidth: 150, textAlign: 'center' }}>{value.from === value.to ? fmtDate(value.from) : `${fmtDate(value.from)} – ${fmtDate(value.to)}`}</b>
          <button className="icon-btn" aria-label="Próximo período" onClick={() => shift(1)}><ChevronRight size={18} /></button>
        </div>
      ) : (
        <div className="row"><input className="input" style={{ width: 150 }} type="date" aria-label="De" value={value.from} onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value, to: value.to < e.target.value ? e.target.value : value.to })} />
          <span className="muted">até</span><input className="input" style={{ width: 150 }} type="date" aria-label="Até" min={value.from} value={value.to} onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })} /></div>
      )}
    </div>
  );
}
