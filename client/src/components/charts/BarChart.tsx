import { useState } from 'react';

export interface Series { key: string; label: string; color: string }
export interface Datum { label: string; title?: string; values: Record<string, number> }

interface Props { data: Datum[]; series: Series[]; height?: number; ariaLabel: string; unit?: string }

/**
 * Gráfico de barras em SVG (simples ou empilhado). Acessível: descrição por aria-label,
 * tooltip ao passar o mouse/tocar, legenda quando há mais de uma série e tabela alternativa.
 */
export function BarChart({ data, series, height = 220, ariaLabel, unit = '' }: Props) {
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [table, setTable] = useState(false);
  const W = 720, H = height, padL = 32, padB = 26, padT = 8;
  const totals = data.map((d) => series.reduce((s, x) => s + (d.values[x.key] ?? 0), 0));
  const max = Math.max(1, ...totals); const niceMax = max <= 4 ? max : Math.ceil(max / 2) * 2;
  const plotH = H - padB - padT; const step = (W - padL) / Math.max(data.length, 1); const bw = Math.min(28, step * 0.62);
  const ticks = niceMax <= 4 ? Array.from({ length: niceMax + 1 }, (_, i) => i) : [0, niceMax / 2, niceMax];
  const every = Math.ceil(data.length / 12);

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} preserveAspectRatio="xMidYMid meet">
        {ticks.map((t) => { const y = padT + plotH - (t / niceMax) * plotH; return (<g key={t}><line x1={padL} x2={W} y1={y} y2={y} stroke="var(--border)" strokeWidth={1} /><text x={padL - 6} y={y + 4} textAnchor="end" fontSize={11} fill="var(--text-3)">{t}</text></g>); })}
        {data.map((d, i) => {
          const x = padL + i * step + (step - bw) / 2; let acc = 0;
          return (
            <g key={i} onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, text: `${d.title ?? d.label}: ${series.map((s) => `${s.label} ${d.values[s.key] ?? 0}`).join(' · ')}${unit}` })} onMouseLeave={() => setTip(null)} onClick={(e) => setTip({ x: e.clientX, y: e.clientY, text: `${d.title ?? d.label}: ${series.map((s) => `${s.label} ${d.values[s.key] ?? 0}`).join(' · ')}` })}>
              <rect x={padL + i * step} y={padT} width={step} height={plotH} fill="transparent" />
              {series.map((s) => {
                const v = d.values[s.key] ?? 0; if (!v) return null;
                const h = (v / niceMax) * plotH; const y = padT + plotH - acc - h; acc += h;
                return <rect key={s.key} x={x} y={y} width={bw} height={Math.max(h - (series.length > 1 ? 2 : 0), 1)} rx={3} fill={s.color} />;
              })}
              {i % every === 0 && <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--text-3)">{d.label}</text>}
            </g>);
        })}
      </svg>
      {series.length > 1 && <div className="legend">{series.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}</div>}
      <button className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={() => setTable((t) => !t)} aria-expanded={table}>{table ? 'Ocultar tabela' : 'Ver como tabela'}</button>
      {table && (
        <div className="table-wrap" style={{ marginTop: 8, maxHeight: 260, overflow: 'auto' }}>
          <table className="table"><thead><tr><th>Período</th>{series.map((s) => <th key={s.key}>{s.label}</th>)}</tr></thead>
            <tbody>{data.map((d, i) => <tr key={i} style={{ cursor: 'default' }}><td>{d.title ?? d.label}</td>{series.map((s) => <td key={s.key}>{d.values[s.key] ?? 0}</td>)}</tr>)}</tbody></table>
        </div>
      )}
      {tip && <div className="tooltip" style={{ left: tip.x + 12, top: tip.y + 12 }}>{tip.text}</div>}
    </div>
  );
}
