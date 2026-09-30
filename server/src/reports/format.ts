import type { Report } from '../services/reports.js';
import { ACTIVITY_LABEL, type ActivityType } from '../types.js';

export const br = (d?: string | null) => (d ? d.split('-').reverse().join('/') : '—');
export const hm = (min: number) => `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
export const PRIORITY_PT: Record<string, string> = { high: 'Alta', medium: 'Média', low: 'Baixa' };
export const typeLabel = (t: string) => ACTIVITY_LABEL[t as ActivityType] ?? t;

/** Linhas planas para CSV/Excel. */
export function activityRows(r: Report) {
  return r.activities.map((a) => ({
    Data: br(a.ref_date), Início: a.start_time ?? '', Fim: a.end_time ?? '', Tipo: typeLabel(a.type), Título: a.title,
    Cliente: a.client_name ?? '', Cidade: a.client_city ?? '', Responsável: a.assignee_name ?? '', Prioridade: PRIORITY_PT[a.priority],
    Status: a.status_name, Atrasada: a.is_overdue ? 'Sim' : 'Não', Observações: a.completion_note ?? a.notes ?? '',
  }));
}

export function toCsv(r: Report) {
  const rows = activityRows(r);
  const head = Object.keys(rows[0] ?? { Data: '', Tipo: '', Título: '', Cliente: '', Status: '' });
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
  // BOM + ; para abrir corretamente no Excel em português
  return '﻿' + [head.map(esc).join(';'), ...rows.map((row) => head.map((h) => esc((row as any)[h])).join(';'))].join('\r\n');
}
