import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { openDatabase } from '../src/db/connection.js';
import { createApp } from '../src/app.js';
import { seedDemo } from '../src/db/seed.js';
import { addDays, today } from '../src/utils/dates.js';

let server: Server; let base = ''; let cookie = ''; let carlaCookie = '';
const db = openDatabase(':memory:');

async function api(path: string, opts: { method?: string; body?: unknown; ck?: string } = {}) {
  const res = await fetch(base + '/api' + path, {
    method: opts.method ?? 'GET',
    headers: { 'content-type': 'application/json', cookie: opts.ck ?? cookie },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  return { status: res.status, body: text && res.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text, headers: res.headers };
}
const login = async (email: string, password: string) => {
  const res = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  return { status: res.status, cookie: (res.headers.get('set-cookie') ?? '').split(';')[0] };
};

before(async () => {
  seedDemo(db);
  server = createApp(db).listen(0);
  base = `http://127.0.0.1:${(server.address() as any).port}`;
  cookie = (await login('admin@operis.local', 'admin123')).cookie;
  carlaCookie = (await login('carla@operis.local', 'carla123')).cookie;
});
after(() => { server.close(); db.close(); });

test('auth: rejeita sem sessão e senha errada', async () => {
  assert.equal((await api('/clients', { ck: '' })).status, 401);
  assert.equal((await login('admin@operis.local', 'errada')).status, 401);
});

test('cliente: cadastrar → visualizar → editar → excluir, com validação e duplicidade', async () => {
  assert.equal((await api('/clients', { method: 'POST', body: { name: 'A' } })).status, 400);
  const bad = await api('/clients', { method: 'POST', body: { name: 'Cliente Teste', email: 'x', phone: '123' } });
  assert.equal(bad.status, 400); assert.match(bad.body.error, /inválid/i);
  const c = await api('/clients', { method: 'POST', body: { name: 'Cliente Teste', city: 'Recife', phone: '(81) 99999-1111' } });
  assert.equal(c.status, 201);
  const dup = await api('/clients', { method: 'POST', body: { name: 'cliente teste', city: 'recife' } });
  assert.equal(dup.status, 409); assert.equal(dup.body.code, 'DUPLICATE_CLIENT');
  const detail = await api(`/clients/${c.body.id}`);
  assert.equal(detail.body.history[0].event_type, 'client_created');
  const up = await api(`/clients/${c.body.id}`, { method: 'PUT', body: { name: 'Cliente Teste 2', city: 'Recife', notes: 'obs' } });
  assert.equal(up.body.name, 'Cliente Teste 2');
  assert.equal((await api(`/clients/${c.body.id}`, { method: 'DELETE' })).status, 204);
  assert.equal((await api(`/clients/${c.body.id}`)).status, 404);
  const list = await api('/clients?q=Central');
  assert.equal(list.body.items[0].name, 'Restaurante Central');
  assert.ok(list.body.items[0].installation_date && list.body.items[0].next_followup);
});

test('instalação: criar → agendar → conflito → status → concluir + histórico', async () => {
  const cid = (await api('/clients?q=Loja')).body.items[0].id;
  const date = addDays(today(), 10);
  const a = await api('/activities', { method: 'POST', body: { type: 'installation', client_id: cid, date, start_time: '14:00', end_time: '15:30', priority: 'high' } });
  assert.equal(a.status, 201); assert.equal(a.body.status_kind, 'scheduled');
  const conf = await api('/activities', { method: 'POST', body: { type: 'installation', client_id: cid, date, start_time: '15:00', end_time: '16:00' } });
  assert.equal(conf.status, 409); assert.equal(conf.body.code, 'SCHEDULE_CONFLICT');
  const okAdj = await api('/activities', { method: 'POST', body: { type: 'training', client_id: cid, date, start_time: '15:30', end_time: '16:30' } });
  assert.equal(okAdj.status, 201, 'horários adjacentes não conflitam');
  const forced = await api('/activities', { method: 'POST', body: { type: 'task', title: 'x', date, start_time: '14:30', force: true } });
  assert.equal(forced.status, 201);
  assert.equal((await api('/activities', { method: 'POST', body: { type: 'installation', client_id: cid, date, start_time: '10:00', end_time: '09:00' } })).status, 400);
  const inprog = (await api('/statuses?scope=installation')).body.find((s: any) => s.kind === 'in_progress');
  assert.equal((await api(`/activities/${a.body.id}/status`, { method: 'PATCH', body: { status_id: inprog.id } })).body.status_kind, 'in_progress');
  const done = await api(`/activities/${a.body.id}/complete`, { method: 'POST', body: { note: 'ok' } });
  assert.equal(done.body.activity.status_kind, 'done');
  assert.ok(done.body.activity.completed_at && done.body.activity.completed_by && done.body.activity.completed_date);
  const hist = (await api(`/clients/${cid}`)).body.history.map((h: any) => h.event_type);
  assert.ok(hist.includes('activity_scheduled') && hist.includes('activity_completed'));
  assert.equal((await api(`/activities/${a.body.id}/complete`, { method: 'POST', body: {} })).status, 400);
});

test('kanban: mover para outro status muda o status e desfaz conclusão ao reabrir', async () => {
  const list = (await api('/activities?type=installation&kind=done')).body;
  const a = list[0];
  const pend = (await api('/statuses?scope=installation')).body.find((s: any) => s.kind === 'pending');
  const moved = await api(`/activities/${a.id}/status`, { method: 'PATCH', body: { status_id: pend.id } });
  assert.equal(moved.body.status_kind, 'pending'); assert.equal(moved.body.completed_at, null);
  const wrong = (await api('/statuses?scope=task')).body[0];
  assert.equal((await api(`/activities/${a.id}/status`, { method: 'PATCH', body: { status_id: wrong.id } })).status, 400);
});

test('acompanhamento: concluir registra próximo acompanhamento', async () => {
  const cid = (await api('/clients?q=Padaria')).body.items[0].id;
  const f = await api('/activities', { method: 'POST', body: { type: 'followup', client_id: cid, date: today(), start_time: '07:00', end_time: '07:10', contact_reason: 'teste' } });
  const next = addDays(today(), 7);
  const r = await api(`/activities/${f.body.id}/complete`, { method: 'POST', body: { note: 'feito', next_followup_date: next } });
  assert.equal(r.body.next_followup.date, next);
  assert.equal((await api(`/clients/${cid}`)).body.client.next_followup <= next, true);
});

test('agenda e filtros por data, atrasados e hoje', async () => {
  const t = (await api('/activities?range=today')).body;
  assert.ok(t.length >= 3 && t.every((a: any) => a.date === today()));
  const w = (await api('/activities?range=week&type=installation')).body;
  assert.ok(w.every((a: any) => a.type === 'installation'));
  const od = (await api('/activities?overdue=1')).body;
  assert.ok(od.length >= 2 && od.every((a: any) => a.is_overdue && !['done', 'canceled'].includes(a.status_kind)));
  assert.equal((await api('/activities?from=2026-13-40&to=2026-01-01')).status, 400);
});

test('tarefa com checklist', async () => {
  const t = await api('/activities', { method: 'POST', body: { type: 'task', title: 'Checklist', checklist: [{ text: 'a', done: false }, { text: 'b', done: false }] } });
  assert.equal(t.body.checklist.length, 2);
  const r = await api(`/checklist/${t.body.checklist[0].id}`, { method: 'PATCH', body: { done: true } });
  assert.equal(r.body.checklist_done, 1);
  assert.equal((await api('/activities', { method: 'POST', body: { type: 'task' } })).status, 400);
});

test('status personalizados: criar, bloquear exclusão em uso, substituir', async () => {
  const s = await api('/statuses', { method: 'POST', body: { scope: 'installation', name: 'Aguardando material', kind: 'attention', color: '#ca8a04' } });
  assert.equal(s.status, 201);
  assert.equal((await api('/statuses', { method: 'POST', body: { scope: 'installation', name: 'aguardando material', kind: 'attention' } })).status, 409);
  const cid = (await api('/clients?q=Loja')).body.items[0].id;
  const a = await api('/activities', { method: 'POST', body: { type: 'installation', client_id: cid, status_id: s.body.id } });
  assert.equal(a.status, 201);
  const del = await api(`/statuses/${s.body.id}`, { method: 'DELETE' });
  assert.equal(del.status, 409); assert.equal(del.body.code, 'STATUS_IN_USE');
  const pend = (await api('/statuses?scope=installation')).body.find((x: any) => x.kind === 'pending');
  assert.equal((await api(`/statuses/${s.body.id}?replace_with=${pend.id}`, { method: 'DELETE' })).status, 204);
  assert.equal((await api(`/activities/${a.body.id}`)).body.status_id, pend.id);
  const done = (await api('/statuses?scope=installation')).body.filter((x: any) => x.kind === 'done');
  for (const d of done.slice(1)) await api(`/statuses/${d.id}`, { method: 'DELETE' });
  assert.equal((await api(`/statuses/${done[0].id}`, { method: 'DELETE' })).status, 400);
});

test('relatório: totais, exportação PDF/XLSX/CSV', async () => {
  const from = addDays(today(), -40), to = addDays(today(), 10);
  const r = (await api(`/reports?range=custom&from=${from}&to=${to}`)).body;
  assert.ok(r.by_type.installation.done >= 3 && r.by_type.training.done >= 3);
  assert.ok(r.totals.completion_rate > 0 && r.clients.new >= 5 && r.activities.length > 10);
  const week = await api('/reports?range=week'); assert.equal(week.status, 200);
  const pdf = await fetch(`${base}/api/reports/export/pdf?range=custom&from=${from}&to=${to}`, { headers: { cookie } });
  assert.equal(pdf.headers.get('content-type'), 'application/pdf');
  assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 4).toString(), '%PDF');
  const xl = await fetch(`${base}/api/reports/export/xlsx?range=week`, { headers: { cookie } });
  assert.equal(Buffer.from(await xl.arrayBuffer()).subarray(0, 2).toString(), 'PK');
  const csv = await api(`/reports/export/csv?range=custom&from=${from}&to=${to}`);
  assert.match(csv.body, /Restaurante Central/);
  assert.equal((await api('/reports?range=custom&from=2026-05-01&to=2026-04-01')).status, 400);
});

test('dashboard, busca global e notificações', async () => {
  const d = (await api('/dashboard')).body;
  assert.ok(d.kpis.clients_total >= 7 && d.today_list.length && d.overdue.length && d.alerts.length);
  const s = (await api('/search?q=Central')).body;
  assert.ok(s.clients.length && s.activities.length && s.history.length);
  const n = (await api('/notifications')).body;
  assert.ok(n.unread > 0);
  await api('/notifications/read-all', { method: 'POST' });
  assert.equal((await api('/notifications')).body.unread, 0);
});

test('permissões: colaborador só vê suas atividades e não administra', async () => {
  const mine = (await api('/activities', { ck: carlaCookie })).body;
  assert.ok(mine.length > 0 && mine.every((a: any) => a.assignee_name === 'Carla Souza'));
  const other = (await api('/activities?type=installation')).body.find((a: any) => a.assignee_name !== 'Carla Souza');
  assert.equal((await api(`/activities/${other.id}`, { ck: carlaCookie })).status, 403);
  assert.equal((await api('/statuses', { method: 'POST', ck: carlaCookie, body: { scope: 'task', name: 'X', kind: 'pending' } })).status, 403);
  assert.equal((await api('/clients/1', { method: 'DELETE', ck: carlaCookie })).status, 403);
});
