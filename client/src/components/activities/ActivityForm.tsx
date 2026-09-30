import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { activitiesApi, clientsApi } from '../../api/services';
import { ApiError } from '../../api/http';
import type { Activity, ActivityType, ChecklistItem, Priority } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, Input, Select, Textarea } from '../ui/Form';
import { ClientForm } from '../clients/ClientForm';
import { useSettings, useStatuses, useTaskCategories, useTrainingTypes, useUsers } from '../../hooks/useLookups';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../hooks/useAuth';
import { ACTIVITY_META, ACTIVITY_TYPES_ORDER, PRIORITY_META } from '../../utils/constants';
import { errorMessage, fieldErrors } from '../../utils/errors';
import { todayISO } from '../../utils/date';

export interface FormDefaults { client_id?: number | null; date?: string | null; start_time?: string | null; end_time?: string | null; status_id?: number | null; title?: string }
interface Props { type: ActivityType; activity?: Activity; defaults?: FormDefaults; onClose: () => void; allowTypeChange?: boolean }

const addMin = (t: string, min: number) => { const [h, m] = t.split(':').map(Number); const x = Math.min(h * 60 + m + min, 23 * 60 + 59); return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };

export function ActivityForm({ type: initialType, activity, defaults = {}, onClose, allowTypeChange }: Props) {
  const qc = useQueryClient(); const toast = useToast(); const { user } = useAuth();
  const [type, setType] = useState<ActivityType>(activity?.type ?? initialType);
  const meta = ACTIVITY_META[type];
  const statuses = useStatuses(meta.scope); const users = useUsers(); const settings = useSettings();
  const ttypes = useTrainingTypes(); const cats = useTaskCategories();
  const clients = useQuery({ queryKey: ['clients', 'select'], queryFn: () => clientsApi.list({ page_size: 200, sort: 'name' }) });
  const [newClient, setNewClient] = useState(false);
  const needsClient = ['installation', 'training', 'followup'].includes(type);

  const [f, setF] = useState(() => ({
    client_id: String(activity?.client_id ?? defaults.client_id ?? ''), title: activity?.title ?? defaults.title ?? '', description: activity?.description ?? '',
    status_id: String(activity?.status_id ?? defaults.status_id ?? ''), priority: (activity?.priority ?? 'medium') as Priority,
    assignee_id: String(activity ? activity.assignee_id ?? '' : user?.id ?? ''), date: activity?.date ?? defaults.date ?? '',
    start_time: activity?.start_time ?? defaults.start_time ?? '', end_time: activity?.end_time ?? defaults.end_time ?? '',
    location: activity?.location ?? '', notes: activity?.notes ?? '', training_type_id: String(activity?.training_type_id ?? ''), content: activity?.content ?? '',
    contact_reason: activity?.contact_reason ?? '', situation: activity?.situation ?? '', problems: activity?.problems ?? '', solutions: activity?.solutions ?? '',
    next_followup_date: activity?.next_followup_date ?? '', category_id: String(activity?.category_id ?? ''),
  }));
  const [checklist, setChecklist] = useState<ChecklistItem[]>(activity?.checklist ?? []);
  const [newItem, setNewItem] = useState('');
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  // Pré-preenche o local com o endereço do cliente (só na criação e se vazio)
  useEffect(() => {
    if (activity || type !== 'installation' || f.location || !f.client_id) return;
    const c = clients.data?.items.find((x) => String(x.id) === f.client_id);
    if (c?.address) set('location', c.address);
  }, [f.client_id, clients.data]);

  const onStart = (v: string) => setF((s) => ({ ...s, start_time: v, end_time: v && (!s.end_time || s.end_time <= v) ? addMin(v, settings.data?.default_duration_minutes ?? 60) : s.end_time }));

  const num = (v: string) => (v ? Number(v) : null);
  const save = useMutation({
    mutationFn: (force: boolean) => {
      const body = {
        type, client_id: num(f.client_id), title: f.title, description: f.description, status_id: num(f.status_id), priority: f.priority, assignee_id: num(f.assignee_id),
        date: f.date, start_time: f.start_time, end_time: f.end_time, location: f.location, notes: f.notes, training_type_id: num(f.training_type_id), content: f.content,
        contact_reason: f.contact_reason, situation: f.situation, problems: f.problems, solutions: f.solutions, next_followup_date: f.next_followup_date,
        category_id: num(f.category_id), checklist: type === 'task' ? checklist : undefined, force,
      };
      return activity ? activitiesApi.update(activity.id, body) : activitiesApi.create(body);
    },
    onSuccess: (a) => {
      qc.invalidateQueries();
      const scheduled = a.status_kind === 'scheduled' && !activity;
      const g = meta.fem ? 'a' : 'o';
      toast.success(`✓ ${meta.label} ${activity ? 'atualizad' : scheduled ? 'agendad' : 'criad'}${g} com sucesso.`);
      onClose();
    },
  });
  const err = save.error;
  const isConflict = err instanceof ApiError && err.code === 'SCHEDULE_CONFLICT';
  const errs = fieldErrors(err);
  const general = err && !isConflict && !Object.keys(errs).length ? errorMessage(err) : null;
  const submit = (e: React.FormEvent) => { e.preventDefault(); save.mutate(false); };
  const addItem = () => { const t = newItem.trim(); if (t) { setChecklist((c) => [...c, { text: t, done: false }]); setNewItem(''); } };
  const article = meta.fem ? 'Nova' : 'Novo';

  return (
    <>
      <Modal title={activity ? `Editar ${meta.label.toLowerCase()}` : `${article} ${meta.label.toLowerCase()}`} onClose={onClose} size="lg"
        footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button>
          {isConflict ? <Button variant="primary" loading={save.isPending} onClick={() => save.mutate(true)}>Agendar mesmo assim</Button>
            : <Button variant="primary" type="submit" form="act-form" loading={save.isPending}>{activity ? 'Salvar alterações' : 'Salvar'}</Button>}</>}>
        <form id="act-form" className="form-grid" onSubmit={submit} noValidate>
          {general && <div className="form-error span-2">{general}</div>}
          {isConflict && <div className="form-warn span-2" role="alert"><b>Conflito de horário.</b> {err.message.replace('Conflito de horário: ', '')} Ajuste o horário ou confirme para agendar mesmo assim.</div>}
          {allowTypeChange && !activity && (
            <Field label="Tipo" className="span-2" htmlFor="a-type">
              <Select id="a-type" value={type} onChange={(e) => { setType(e.target.value as ActivityType); set('status_id', ''); }}>
                {ACTIVITY_TYPES_ORDER.map((t) => <option key={t} value={t}>{ACTIVITY_META[t].label}</option>)}
              </Select>
            </Field>
          )}
          {(needsClient || ['task', 'meeting', 'event'].includes(type)) && (
            <Field label={needsClient ? 'Cliente *' : 'Cliente relacionado'} error={errs.client_id} className="span-2" htmlFor="a-client">
              <div className="row">
                <Select id="a-client" value={f.client_id} onChange={(e) => set('client_id', e.target.value)} style={{ flex: 1 }}>
                  <option value="">{needsClient ? 'Selecione o cliente…' : 'Nenhum'}</option>
                  {clients.data?.items.map((c) => <option key={c.id} value={c.id}>{c.name}{c.city ? ` — ${c.city}` : ''}</option>)}
                </Select>
                <Button onClick={() => setNewClient(true)} aria-label="Cadastrar novo cliente"><Plus size={16} /> Novo</Button>
              </div>
            </Field>
          )}
          <Field label={needsClient ? 'Título (opcional)' : 'Título *'} error={errs.title} className="span-2" htmlFor="a-title">
            <Input id="a-title" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder={needsClient ? `${meta.label} — nome do cliente` : type === 'task' ? 'Ex.: Ligar para o cliente' : 'Ex.: Reunião de alinhamento'} autoFocus={!needsClient} />
          </Field>

          <Field label="Data" error={errs.date} htmlFor="a-date"><Input id="a-date" type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></Field>
          <div className="form-grid" style={{ gridColumn: 'auto' }}>
            <Field label="Início" error={errs.start_time} htmlFor="a-start"><Input id="a-start" type="time" value={f.start_time} onChange={(e) => onStart(e.target.value)} /></Field>
            <Field label="Fim" error={errs.end_time} htmlFor="a-end"><Input id="a-end" type="time" value={f.end_time} onChange={(e) => set('end_time', e.target.value)} /></Field>
          </div>

          <Field label="Responsável" htmlFor="a-assignee">
            <Select id="a-assignee" value={f.assignee_id} onChange={(e) => set('assignee_id', e.target.value)}>
              <option value="">Sem responsável</option>{users.data?.filter((u) => u.active || String(u.id) === f.assignee_id).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </Field>
          <Field label="Status" htmlFor="a-status">
            <Select id="a-status" value={f.status_id} onChange={(e) => set('status_id', e.target.value)}>
              {!activity && <option value="">Automático ({f.date ? 'agendado' : 'inicial'})</option>}
              {statuses.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>

          <div className="field span-2">
            <label id="prio-l">Prioridade</label>
            <div className="seg" role="group" aria-labelledby="prio-l" style={{ alignSelf: 'flex-start' }}>
              {(Object.keys(PRIORITY_META) as Priority[]).map((p) => <button key={p} type="button" aria-pressed={f.priority === p} onClick={() => setF((s) => ({ ...s, priority: p }))}>{PRIORITY_META[p].emoji} {PRIORITY_META[p].label}</button>)}
            </div>
          </div>

          {(type === 'installation' || type === 'meeting' || type === 'event') && (
            <Field label="Local" error={errs.location} className="span-2" htmlFor="a-loc"><Input id="a-loc" value={f.location} onChange={(e) => set('location', e.target.value)} /></Field>
          )}
          {type === 'training' && (<>
            <Field label="Tipo de treinamento" htmlFor="a-tt">
              <Select id="a-tt" value={f.training_type_id} onChange={(e) => set('training_type_id', e.target.value)}><option value="">Selecione…</option>{ttypes.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
            </Field>
            <Field label="Local" htmlFor="a-loc"><Input id="a-loc" value={f.location} onChange={(e) => set('location', e.target.value)} /></Field>
            <Field label="Conteúdo do treinamento" className="span-2" htmlFor="a-content"><Textarea id="a-content" value={f.content} onChange={(e) => set('content', e.target.value)} /></Field>
          </>)}
          {type === 'followup' && (<>
            <Field label="Motivo do contato" className="span-2" htmlFor="a-reason"><Input id="a-reason" value={f.contact_reason} onChange={(e) => set('contact_reason', e.target.value)} /></Field>
            <Field label="Situação encontrada" htmlFor="a-sit"><Textarea id="a-sit" value={f.situation} onChange={(e) => set('situation', e.target.value)} /></Field>
            <Field label="Problemas relatados" htmlFor="a-prob"><Textarea id="a-prob" value={f.problems} onChange={(e) => set('problems', e.target.value)} /></Field>
            <Field label="Soluções realizadas" htmlFor="a-sol"><Textarea id="a-sol" value={f.solutions} onChange={(e) => set('solutions', e.target.value)} /></Field>
            <Field label="Próximo acompanhamento" htmlFor="a-next" hint="Ao concluir, o sistema já cria o próximo."><Input id="a-next" type="date" min={todayISO()} value={f.next_followup_date} onChange={(e) => set('next_followup_date', e.target.value)} /></Field>
          </>)}
          {type === 'task' && (<>
            <Field label="Categoria" htmlFor="a-cat"><Select id="a-cat" value={f.category_id} onChange={(e) => set('category_id', e.target.value)}><option value="">Sem categoria</option>{cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
            <Field label="Descrição" className="span-2" htmlFor="a-desc"><Textarea id="a-desc" value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
            <div className="field span-2">
              <label>Checklist</label>
              {checklist.map((it, i) => (
                <div key={i} className="checklist-row">
                  <input type="checkbox" checked={it.done} aria-label={`Marcar ${it.text}`} onChange={() => setChecklist((c) => c.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))} />
                  <span style={{ flex: 1, textDecoration: it.done ? 'line-through' : 'none' }}>{it.text}</span>
                  <button type="button" className="icon-btn" aria-label={`Remover ${it.text}`} onClick={() => setChecklist((c) => c.filter((_, j) => j !== i))}><X size={14} /></button>
                </div>
              ))}
              <div className="row"><Input value={newItem} placeholder="Novo item…" onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }} /><Button onClick={addItem}><Plus size={16} /></Button></div>
            </div>
          </>)}
          <Field label="Observações" error={errs.notes} className="span-2" htmlFor="a-notes"><Textarea id="a-notes" value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        </form>
      </Modal>
      {newClient && <ClientForm onClose={() => setNewClient(false)} onSaved={(c) => { set('client_id', String(c.id)); qc.invalidateQueries({ queryKey: ['clients'] }); }} />}
    </>
  );
}
