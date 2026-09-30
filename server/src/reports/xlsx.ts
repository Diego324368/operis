import ExcelJS from 'exceljs';
import type { Report } from '../services/reports.js';
import { activityRows, br, hm, typeLabel } from './format.js';

export async function toXlsx(r: Report, company: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = company;
  const head = (row: ExcelJS.Row) => {
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
  };

  const s = wb.addWorksheet('Resumo');
  s.addRow(['Relatório operacional']).font = { bold: true, size: 16 };
  s.addRow([`Período: ${br(r.period.from)} a ${br(r.period.to)}`]);
  s.addRow([]);
  head(s.addRow(['Tipo', 'Total', 'Concluídas', 'Pendentes', 'Agendadas', 'Em andamento', 'Atenção', 'Canceladas', 'Atrasadas']));
  Object.entries(r.by_type).forEach(([t, v]) => s.addRow([typeLabel(t), v.total, v.done, v.pending, v.scheduled, v.in_progress, v.attention, v.canceled, v.overdue]));
  s.addRow([]);
  head(s.addRow(['Clientes', 'Quantidade']));
  s.addRow(['Novos no período', r.clients.new]); s.addRow(['Atendidos no período', r.clients.attended]);
  s.addRow(['Ativos', r.clients.active]); s.addRow(['Finalizados', r.clients.finished]);
  s.addRow([]);
  s.addRow(['Taxa de conclusão', `${r.totals.completion_rate}%`]);
  s.addRow(['Tempo em atividades concluídas', hm(r.totals.minutes_done)]);
  s.columns.forEach((c) => (c.width = 20));
  s.getColumn(1).width = 34;

  const a = wb.addWorksheet('Atividades');
  const rows = activityRows(r);
  const keys = Object.keys(rows[0] ?? { Data: 0 });
  head(a.addRow(keys));
  rows.forEach((row) => a.addRow(keys.map((k) => (row as any)[k])));
  a.columns.forEach((c, i) => (c.width = keys[i] === 'Observações' || keys[i] === 'Título' ? 40 : 16));
  a.views = [{ state: 'frozen', ySplit: 1 }];
  a.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: keys.length } };

  const n = wb.addWorksheet('Observações');
  head(n.addRow(['Data', 'Tipo', 'Cliente', 'Observação']));
  r.notes.forEach((x) => n.addRow([br(x.date), x.label, x.client ?? '', x.text]));
  n.columns = [{ width: 12 }, { width: 16 }, { width: 28 }, { width: 90 }];
  n.eachRow((row) => (row.alignment = { wrapText: true, vertical: 'top' }));

  return Buffer.from(await wb.xlsx.writeBuffer());
}
