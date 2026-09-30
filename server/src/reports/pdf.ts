import PDFDocument from 'pdfkit';
import type { Report } from '../services/reports.js';
import { br, hm, typeLabel } from './format.js';

const C = { primary: '#1e40af', text: '#0f172a', muted: '#64748b', line: '#e2e8f0', bg: '#f1f5f9', ok: '#15803d', bad: '#b91c1c' };

export function toPdf(r: Report, company: string, title = 'RELATÓRIO OPERACIONAL'): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true, info: { Title: title, Author: company } });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    const W = doc.page.width - 80;
    const ensure = (h: number) => { if (doc.y + h > doc.page.height - 60) doc.addPage(); };

    doc.rect(0, 0, doc.page.width, 92).fill(C.primary);
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(20).text(title, 40, 28);
    doc.font('Helvetica').fontSize(11).text(`Período: ${br(r.period.from)} até ${br(r.period.to)}`, 40, 56);
    doc.fontSize(9).text(`${company} · Gerado em ${new Date(r.generated_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`, 40, 72);
    doc.y = 112;

    const h2 = (t: string) => { ensure(40); doc.moveDown(0.6).fillColor(C.primary).font('Helvetica-Bold').fontSize(12).text(t.toUpperCase(), 40); doc.moveTo(40, doc.y + 2).lineTo(40 + W, doc.y + 2).strokeColor(C.line).stroke(); doc.moveDown(0.5); };

    h2('Resumo');
    const cards: [string, string][] = [
      ['Clientes atendidos', String(r.clients.attended)], ['Instalações realizadas', String(r.by_type.installation.done)],
      ['Treinamentos realizados', String(r.by_type.training.done)], ['Acompanhamentos realizados', String(r.by_type.followup.done)],
      ['Novos clientes', String(r.clients.new)], ['Taxa de conclusão', `${r.totals.completion_rate}%`],
      ['Pendentes', String(r.totals.pending)], ['Atrasadas', String(r.totals.overdue)],
    ];
    const cw = (W - 30) / 4; const y0 = doc.y;
    cards.forEach(([k, v], i) => {
      const x = 40 + (i % 4) * (cw + 10); const y = y0 + Math.floor(i / 4) * 58;
      doc.roundedRect(x, y, cw, 50, 6).fill(C.bg);
      doc.fillColor(C.text).font('Helvetica-Bold').fontSize(18).text(v, x + 10, y + 8, { width: cw - 20 });
      doc.fillColor(C.muted).font('Helvetica').fontSize(8).text(k, x + 10, y + 32, { width: cw - 20 });
    });
    doc.y = y0 + 124;

    h2('Atividades por tipo');
    const cols = [110, 45, 60, 60, 60, 55, 55, 55]; const heads = ['Tipo', 'Total', 'Concluídas', 'Pendentes', 'Agendadas', 'Em and.', 'Cancel.', 'Atrasadas'];
    const row = (vals: string[], bold = false, fill?: string) => {
      ensure(20); const y = doc.y; let x = 40;
      if (fill) doc.rect(40, y - 3, W, 18).fill(fill);
      vals.forEach((v, i) => { doc.fillColor(bold && fill === C.primary ? '#fff' : C.text).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).text(v, x + 4, y, { width: cols[i] - 6 }); x += cols[i]; });
      doc.y = y + 18;
    };
    row(heads, true, C.primary);
    Object.entries(r.by_type).filter(([, v]) => v.total).forEach(([t, v], i) => row([typeLabel(t), v.total, v.done, v.pending, v.scheduled, v.in_progress, v.canceled, v.overdue].map(String), false, i % 2 ? undefined : C.bg));

    h2('Clientes');
    doc.fillColor(C.text).font('Helvetica').fontSize(10)
      .text(`Novos no período: ${r.clients.new}   ·   Atendidos: ${r.clients.attended}   ·   Ativos: ${r.clients.active}   ·   Finalizados: ${r.clients.finished}`)
      .text(`Tempo total em atividades concluídas (com horário): ${hm(r.totals.minutes_done)}`);

    h2('Atividades do período');
    if (!r.activities.length) doc.fillColor(C.muted).fontSize(10).text('Nenhuma atividade no período.');
    const ac = [58, 42, 78, 150, 100, 87]; const ah = ['Data', 'Hora', 'Tipo', 'Cliente / Título', 'Responsável', 'Status'];
    if (r.activities.length) {
      const arow = (vals: string[], head = false, fill?: string, color = C.text) => {
        ensure(20); const y = doc.y; let x = 40;
        if (fill) doc.rect(40, y - 3, W, 16).fill(fill);
        vals.forEach((v, i) => { doc.fillColor(head ? '#fff' : color).font(head ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).text(v, x + 3, y, { width: ac[i] - 5, height: 11, ellipsis: true, lineBreak: false }); x += ac[i]; });
        doc.y = y + 16;
      };
      arow(ah, true, C.primary);
      r.activities.forEach((a, i) => arow([br(a.ref_date), a.start_time ?? '—', typeLabel(a.type), a.client_name ?? a.title, a.assignee_name ?? '—', a.is_overdue ? `${a.status_name} (atrasada)` : a.status_name], false, i % 2 ? undefined : C.bg, a.is_overdue ? C.bad : C.text));
    }

    h2('Observações');
    if (!r.notes.length) doc.fillColor(C.muted).fontSize(10).font('Helvetica').text('Sem observações registradas no período.');
    r.notes.slice(0, 60).forEach((n) => {
      ensure(36);
      doc.fillColor(C.text).font('Helvetica-Bold').fontSize(9).text(`${br(n.date)} — ${n.label}${n.client ? ` — ${n.client}` : ''}`, 40);
      doc.fillColor(C.muted).font('Helvetica').fontSize(9).text(n.text, 40, doc.y, { width: W }); doc.moveDown(0.4);
    });

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.fillColor(C.muted).fontSize(8).text(`Página ${i + 1} de ${range.count}`, 40, doc.page.height - 32, { width: W, align: 'right', lineBreak: false });
    }
    doc.end();
  });
}
