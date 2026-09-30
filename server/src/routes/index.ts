import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { DB } from '../db/connection.js';
import { config } from '../config.js';
import { COOKIE, requireAdmin, requireAuth, signToken } from '../middleware/auth.js';
import * as V from '../validation/schemas.js';
import * as activities from '../services/activities.js';
import * as clients from '../services/clients.js';
import * as statuses from '../services/statuses.js';
import * as users from '../services/users.js';
import * as notifs from '../services/notifications.js';
import { getSettings, updateSettings } from '../services/settings.js';
import { lookupService } from '../services/lookups.js';
import { getDashboard } from '../services/dashboard.js';
import { globalSearch } from '../services/search.js';
import { getReport, listSavedReports, saveReport } from '../services/reports.js';
import { toCsv } from '../reports/format.js';
import { toXlsx } from '../reports/xlsx.js';
import { toPdf } from '../reports/pdf.js';
import { addDays, resolveRange, startOfWeek, today } from '../utils/dates.js';
import { unauthorized, badRequest } from '../utils/errors.js';

const idParam = (v: unknown) => z.coerce.number().int().positive().parse(v);
const optNum = z.coerce.number().int().positive().optional();
const cookieOpts = { httpOnly: true, sameSite: 'lax' as const, secure: config.isProd && process.env.COOKIE_SECURE !== 'false', maxAge: 7 * 86400_000, path: '/' };

export function buildRouter(db: DB) {
  const r = Router();
  const auth = requireAuth(db);
  const trainingTypes = lookupService(db, 'training_types', 'training_type_id', 'Tipo de treinamento');
  const categories = lookupService(db, 'task_categories', 'category_id', 'Categoria');

  // ---------- Auth ----------
  const loginLimiter = rateLimit({ windowMs: 15 * 60_000, limit: config.isProd ? 20 : 500, standardHeaders: true, legacyHeaders: false, message: { error: 'Muitas tentativas. Aguarde alguns minutos.', code: 'RATE_LIMIT' } });
  r.get('/health', (_q, s) => s.json({ ok: true }));
  r.post('/auth/login', loginLimiter, (req, res) => {
    const { email, password } = V.loginSchema.parse(req.body);
    const u = db.prepare('SELECT id, name, email, role, password_hash FROM users WHERE email = ? AND active = 1').get(email) as any;
    if (!u || !bcrypt.compareSync(password, u.password_hash)) throw unauthorized('E-mail ou senha incorretos.');
    const user = { id: u.id, name: u.name, email: u.email, role: u.role };
    res.cookie(COOKIE, signToken(user), cookieOpts).json({ user });
  });
  r.post('/auth/logout', (_q, res) => res.clearCookie(COOKIE, { path: '/' }).json({ ok: true }));

  r.get('/auth/me', (req, res) => {
    if (!req.cookies?.[COOKIE]) return res.json({ user: null });
    auth(req, res, () => res.json({ user: req.user }));
  });
  r.use(auth);
  r.put('/auth/me', (req, res) => res.json({ user: users.updateProfile(db, req.user, V.profileSchema.parse(req.body)) }));

  // ---------- Dashboard / busca / notificações ----------
  r.get('/dashboard', (req, res) => res.json(getDashboard(db, req.user)));
  r.get('/search', (req, res) => res.json(globalSearch(db, req.user, String(req.query.q ?? ''))));
  r.get('/notifications', (req, res) => res.json(notifs.listNotifications(db, req.user)));
  r.post('/notifications/read-all', (req, res) => { notifs.markAllRead(db, req.user); res.json({ ok: true }); });
  r.post('/notifications/:id/read', (req, res) => { notifs.markRead(db, req.user, idParam(req.params.id)); res.json({ ok: true }); });

  // ---------- Clientes ----------
  r.get('/clients', (req, res) => {
    const q = z.object({
      q: z.string().optional(), status_id: optNum, city: z.string().optional(), assignee_id: optNum,
      favorite: z.enum(['1', 'true']).optional(), sort: z.string().optional(), order: z.enum(['asc', 'desc']).optional(),
      page: optNum, page_size: optNum,
    }).parse(req.query);
    res.json(clients.listClients(db, { ...q, favorite: !!q.favorite }));
  });
  r.get('/clients/cities', (_q, res) => res.json(clients.listCities(db)));
  r.post('/clients', (req, res) => res.status(201).json(clients.createClient(db, req.user, V.clientSchema.parse(req.body))));
  r.get('/clients/:id', (req, res) => res.json(clients.clientDetail(db, req.user, idParam(req.params.id))));
  r.put('/clients/:id', (req, res) => res.json(clients.updateClient(db, req.user, idParam(req.params.id), V.clientSchema.parse(req.body))));
  r.patch('/clients/:id/favorite', (req, res) => res.json(clients.setFavorite(db, idParam(req.params.id), z.object({ favorite: z.boolean() }).parse(req.body).favorite)));
  r.post('/clients/:id/notes', (req, res) => {
    clients.addQuickNote(db, req.user, idParam(req.params.id), z.object({ text: z.string().trim().min(1, 'Escreva a anotação.').max(2000) }).parse(req.body).text);
    res.status(201).json({ ok: true });
  });
  r.delete('/clients/:id', requireAdmin, (req, res) => { clients.deleteClient(db, idParam(req.params.id)); res.status(204).end(); });

  // ---------- Atividades ----------
  r.get('/activities', (req, res) => {
    const q = V.rangeQuery.extend({
      type: z.string().optional(), status_id: optNum, kind: z.string().optional(), client_id: optNum, assignee_id: optNum,
      city: z.string().optional(), priority: z.string().optional(), q: z.string().optional(),
      overdue: z.enum(['1', 'true']).optional(), sort: z.enum(['date', 'priority', 'created']).optional(),
    }).parse(req.query);
    res.json(activities.listActivities(db, req.user, { ...q, overdue: !!q.overdue }));
  });
  r.post('/activities', (req, res) => res.status(201).json(activities.createActivity(db, req.user, V.activitySchema.parse(req.body))));
  r.get('/activities/:id', (req, res) => res.json(activities.getActivity(db, req.user, idParam(req.params.id))));
  r.put('/activities/:id', (req, res) => res.json(activities.updateActivity(db, req.user, idParam(req.params.id), V.activitySchema.parse(req.body))));
  r.patch('/activities/:id/status', (req, res) => {
    const b = V.activityPatchSchema.parse(req.body);
    res.json(activities.changeStatus(db, req.user, idParam(req.params.id), b.status_id, b.note ?? null));
  });
  r.post('/activities/:id/complete', (req, res) => res.json(activities.completeActivity(db, req.user, idParam(req.params.id), V.completeSchema.parse(req.body ?? {}))));
  r.delete('/activities/:id', (req, res) => { activities.deleteActivity(db, req.user, idParam(req.params.id)); res.status(204).end(); });
  r.patch('/checklist/:id', (req, res) => res.json(activities.toggleChecklistItem(db, req.user, idParam(req.params.id), z.object({ done: z.boolean() }).parse(req.body).done)));
  r.post('/activities/check-conflicts', (req, res) => {
    const b = z.object({ assignee_id: z.number().nullable().optional(), date: z.string().nullable().optional(), start_time: z.string().nullable().optional(), end_time: z.string().nullable().optional(), exclude_id: z.number().optional() }).parse(req.body);
    res.json(activities.findConflicts(db, { ...b, assignee_id: b.assignee_id ?? req.user.id }, b.exclude_id));
  });

  // ---------- Cadastros de apoio ----------
  r.get('/statuses', (req, res) => res.json(statuses.listStatuses(db, req.query.scope ? String(req.query.scope) : undefined)));
  r.post('/statuses', requireAdmin, (req, res) => res.status(201).json(statuses.createStatus(db, V.statusSchema.parse(req.body) as any)));
  r.put('/statuses/reorder', requireAdmin, (req, res) => {
    const b = z.object({ scope: z.string(), ids: z.array(z.number().int()) }).parse(req.body);
    res.json(statuses.reorderStatuses(db, b.scope, b.ids));
  });
  r.put('/statuses/:id', requireAdmin, (req, res) => res.json(statuses.updateStatus(db, idParam(req.params.id), V.statusSchema.parse(req.body))));
  r.delete('/statuses/:id', requireAdmin, (req, res) => { statuses.deleteStatus(db, idParam(req.params.id), optNum.parse(req.query.replace_with)); res.status(204).end(); });

  for (const [path, svc] of [['training-types', trainingTypes], ['task-categories', categories]] as const) {
    r.get(`/${path}`, (req, res) => res.json(svc.list(req.query.all === '1')));
    r.post(`/${path}`, requireAdmin, (req, res) => res.status(201).json(svc.create(V.nameSchema.parse(req.body).name)));
    r.put(`/${path}/:id`, requireAdmin, (req, res) => res.json(svc.update(idParam(req.params.id), V.nameSchema.parse(req.body))));
    r.delete(`/${path}/:id`, requireAdmin, (req, res) => res.json(svc.remove(idParam(req.params.id))));
  }

  r.get('/users', (req, res) => res.json(users.listUsers(db, req.user.role === 'admin')));
  r.post('/users', requireAdmin, (req, res) => res.status(201).json(users.createUser(db, V.userCreateSchema.parse(req.body))));
  r.put('/users/:id', requireAdmin, (req, res) => res.json(users.updateUser(db, req.user, idParam(req.params.id), V.userUpdateSchema.parse(req.body))));

  r.get('/settings', (_q, res) => res.json(getSettings(db)));
  r.put('/settings', requireAdmin, (req, res) => res.json(updateSettings(db, V.settingsSchema.parse(req.body))));

  // ---------- Relatórios ----------
  const period = (q: any) => {
    const p = V.rangeQuery.parse(q);
    if (q.preset === 'week') return { from: startOfWeek(today()), to: addDays(startOfWeek(today()), 6) };
    return resolveRange(p.range ?? 'week', p.from, p.to);
  };
  r.get('/reports', (req, res) => { const p = period(req.query); res.json(getReport(db, req.user, p.from, p.to)); });
  r.post('/reports/save', (req, res) => {
    const p = period(req.body);
    const rep = getReport(db, req.user, p.from, p.to);
    res.status(201).json({ id: saveReport(db, req.user, String(req.body?.title ?? `Relatório ${p.from} a ${p.to}`).slice(0, 120), rep) });
  });
  r.get('/reports/saved', (_q, res) => res.json(listSavedReports(db)));
  r.get('/reports/export/:format', async (req, res) => {
    const p = period(req.query);
    const rep = getReport(db, req.user, p.from, p.to);
    const company = getSettings(db).company_name;
    const name = `relatorio_${p.from}_a_${p.to}`;
    const fmt = req.params.format;
    if (fmt === 'pdf') res.type('application/pdf').attachment(`${name}.pdf`).send(await toPdf(rep, company, req.query.preset === 'week' ? 'RELATÓRIO SEMANAL' : 'RELATÓRIO OPERACIONAL'));
    else if (fmt === 'xlsx') res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').attachment(`${name}.xlsx`).send(await toXlsx(rep, company));
    else if (fmt === 'csv') res.type('text/csv; charset=utf-8').attachment(`${name}.csv`).send(toCsv(rep));
    else throw badRequest('Formato de exportação inválido.');
  });

  return r;
}
