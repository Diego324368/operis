import { z } from 'zod';

const emptyToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);
const optText = (max = 2000) =>
  z.preprocess(emptyToNull, z.string().trim().max(max, `Texto muito longo (máximo ${max} caracteres).`).nullable().optional());

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
export const isoDate = z
  .string({ error: 'Informe uma data válida.' })
  .regex(dateRe, 'Data inválida. Use o formato AAAA-MM-DD.')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, 'Essa data não existe no calendário.');
const optDate = z.preprocess(emptyToNull, isoDate.nullable().optional());
const optTime = z.preprocess(
  emptyToNull,
  z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido. Use HH:MM (00:00 a 23:59).').nullable().optional(),
);
const optId = z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable().optional());
const id = z.coerce.number().int().positive();

const optPhone = z.preprocess(
  emptyToNull,
  z
    .string()
    .trim()
    .refine((v) => {
      const d = v.replace(/\D/g, '');
      return d.length >= 10 && d.length <= 13;
    }, 'Telefone inválido. Informe DDD + número (ex.: (11) 98765-4321).')
    .nullable()
    .optional(),
);
const optEmail = z.preprocess(emptyToNull, z.string().trim().max(160).pipe(z.email('E-mail inválido.')).nullable().optional());

export const priority = z.enum(['high', 'medium', 'low'], { error: 'Prioridade inválida.' });
export const activityType = z.enum(['installation', 'training', 'followup', 'task', 'meeting', 'event'], {
  error: 'Tipo de atividade inválido.',
});

export const loginSchema = z.object({
  email: z.email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe a senha.'),
});

export const clientSchema = z.object({
  name: z.string({ error: 'Informe o nome do cliente.' }).trim().min(2, 'Informe o nome/razão social do cliente.').max(160),
  trade_name: optText(160),
  contact_name: optText(120),
  phone: optPhone,
  whatsapp: optPhone,
  email: optEmail,
  address: optText(240),
  city: optText(80),
  notes: optText(5000),
  status_id: optId,
  assignee_id: optId,
  is_favorite: z.boolean().optional(),
  force: z.boolean().optional(), // ignora aviso de duplicidade
});

const checklistItem = z.object({
  id: z.number().int().optional(),
  text: z.string().trim().min(1, 'Item de checklist vazio.').max(200),
  done: z.boolean().default(false),
});

export const activitySchema = z
  .object({
    type: activityType,
    client_id: optId,
    title: optText(160),
    description: optText(5000),
    status_id: optId,
    priority: priority.default('medium'),
    assignee_id: optId,
    date: optDate,
    start_time: optTime,
    end_time: optTime,
    location: optText(240),
    notes: optText(5000),
    training_type_id: optId,
    content: optText(5000),
    contact_reason: optText(500),
    situation: optText(3000),
    problems: optText(3000),
    solutions: optText(3000),
    next_followup_date: optDate,
    category_id: optId,
    checklist: z.array(checklistItem).max(50, 'Checklist com itens demais (máx. 50).').optional(),
    force: z.boolean().optional(), // ignora aviso de conflito de horário
  })
  .superRefine((v, ctx) => {
    if (v.end_time && !v.start_time)
      ctx.addIssue({ code: 'custom', path: ['start_time'], message: 'Informe o horário inicial.' });
    if (v.start_time && v.end_time && v.end_time <= v.start_time)
      ctx.addIssue({ code: 'custom', path: ['end_time'], message: 'O horário final deve ser depois do horário inicial.' });
    if (v.start_time && !v.date)
      ctx.addIssue({ code: 'custom', path: ['date'], message: 'Informe a data para usar horário.' });
    if (['installation', 'training', 'followup'].includes(v.type) && !v.client_id)
      ctx.addIssue({ code: 'custom', path: ['client_id'], message: 'Selecione o cliente.' });
    if (['task', 'meeting', 'event'].includes(v.type) && !v.title)
      ctx.addIssue({ code: 'custom', path: ['title'], message: 'Informe um título.' });
  });

export const activityPatchSchema = z.object({
  status_id: id,
  note: optText(2000),
});

export const completeSchema = z.object({
  status_id: optId,
  note: optText(2000),
  next_followup_date: optDate,
});

export const statusSchema = z.object({
  scope: z.enum(['client', 'installation', 'training', 'followup', 'task', 'event']).optional(),
  name: z.string().trim().min(1, 'Informe o nome do status.').max(40),
  kind: z.enum(['pending', 'scheduled', 'in_progress', 'attention', 'done', 'canceled'], { error: 'Categoria inválida.' }),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida.').optional().nullable(),
});

export const nameSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome.').max(60),
  active: z.boolean().optional(),
});

export const userCreateSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome.').max(80),
  email: z.email('E-mail inválido.'),
  password: z.string().min(6, 'A senha deve ter ao menos 6 caracteres.').max(100),
  role: z.enum(['admin', 'member']).default('member'),
});
export const userUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.email('E-mail inválido.').optional(),
  password: z.string().min(6, 'A senha deve ter ao menos 6 caracteres.').max(100).optional(),
  role: z.enum(['admin', 'member']).optional(),
  active: z.boolean().optional(),
});
export const profileSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome.').max(80).optional(),
  email: z.email('E-mail inválido.').optional(),
  current_password: z.string().optional(),
  new_password: z.string().min(6, 'A nova senha deve ter ao menos 6 caracteres.').max(100).optional(),
});

export const settingsSchema = z.object({
  no_followup_days: z.coerce.number().int().min(1).max(365).optional(),
  reminder_lead_minutes: z.coerce.number().int().min(5).max(1440).optional(),
  default_duration_minutes: z.coerce.number().int().min(15).max(600).optional(),
  browser_notifications: z.boolean().optional(),
  company_name: z.string().trim().min(1).max(80).optional(),
  work_start: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  work_end: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export const rangeQuery = z.object({
  range: z.enum(['today', 'tomorrow', 'week', 'next_week', 'month', 'last_month', 'custom']).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});
