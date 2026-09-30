import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { statusesApi } from '../../api/services';
import { ApiError } from '../../api/http';
import type { Status, StatusKind, StatusScope } from '../../types';
import { useAllStatuses } from '../../hooks/useLookups';
import { useToast } from '../../hooks/useToast';
import { useConfirm } from '../../hooks/useConfirm';
import { KIND_META } from '../../utils/constants';
import { errorMessage, fieldErrors } from '../../utils/errors';
import { Button } from '../ui/Button';
import { Field, Input, Select } from '../ui/Form';
import { Modal } from '../ui/Modal';
import { ListSkeleton } from '../ui/States';

const SCOPES: { key: StatusScope; label: string }[] = [
  { key: 'client', label: 'Clientes' }, { key: 'installation', label: 'Instalações' }, { key: 'training', label: 'Treinamentos' },
  { key: 'followup', label: 'Acompanhamentos' }, { key: 'task', label: 'Tarefas' }, { key: 'event', label: 'Reuniões e eventos' },
];
const KIND_HELP: Record<StatusKind, string> = {
  pending: 'Ainda não iniciado', scheduled: 'Tem data marcada', in_progress: 'Sendo executado', attention: 'Precisa de atenção/retorno', done: 'Finalizado (entra nos relatórios como realizado)', canceled: 'Cancelado / inativo',
};

function StatusForm({ scope, status, onClose }: { scope: StatusScope; status?: Status; onClose: () => void }) {
  const qc = useQueryClient(); const toast = useToast();
  const [f, setF] = useState({ name: status?.name ?? '', kind: status?.kind ?? ('pending' as StatusKind), color: status?.color ?? '#64748b' });
  const save = useMutation({
    mutationFn: () => status ? statusesApi.update(status.id, f) : statusesApi.create({ ...f, scope }),
    onSuccess: () => { qc.invalidateQueries(); toast.success(status ? '✓ Status atualizado.' : '✓ Status criado.'); onClose(); },
  });
  const errs = fieldErrors(save.error); const general = save.error && !Object.keys(errs).length ? errorMessage(save.error) : null;
  return (
    <Modal title={status ? 'Editar status' : 'Novo status'} size="sm" onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" type="submit" form="status-form" loading={save.isPending}>Salvar</Button></>}>
      <form id="status-form" className="col" style={{ gap: 14 }} onSubmit={(e) => { e.preventDefault(); save.mutate(); }} noValidate>
        {general && <div className="form-error">{general}</div>}
        <Field label="Nome" error={errs.name} htmlFor="s-name"><Input id="s-name" value={f.name} maxLength={40} autoFocus onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Categoria" htmlFor="s-kind" hint={KIND_HELP[f.kind]}><Select id="s-kind" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as StatusKind })}>{(Object.keys(KIND_META) as StatusKind[]).map((k) => <option key={k} value={k}>{KIND_META[k].label}</option>)}</Select></Field>
        <Field label="Cor" htmlFor="s-color"><input id="s-color" type="color" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} style={{ width: 60, height: 38, border: '1px solid var(--border-strong)', borderRadius: 8, background: 'none' }} /></Field>
      </form>
    </Modal>
  );
}

export function StatusSettings() {
  const qc = useQueryClient(); const toast = useToast(); const confirm = useConfirm();
  const all = useAllStatuses(); const [scope, setScope] = useState<StatusScope>('installation');
  const [form, setForm] = useState<{ status?: Status } | null>(null);
  const [replace, setReplace] = useState<{ status: Status; used: number; to: string } | null>(null);
  const list = all.data?.filter((s) => s.scope === scope) ?? [];
  const reorder = useMutation({ mutationFn: (ids: number[]) => statusesApi.reorder(scope, ids), onSuccess: () => qc.invalidateQueries({ queryKey: ['statuses'] }), onError: (e) => toast.error(errorMessage(e)) });
  const del = useMutation({
    mutationFn: ({ s, to }: { s: Status; to?: number }) => statusesApi.remove(s.id, to),
    onSuccess: () => { qc.invalidateQueries(); setReplace(null); toast.success('✓ Status excluído.'); },
    onError: (e, { s }) => { if (e instanceof ApiError && e.code === 'STATUS_IN_USE') setReplace({ status: s, used: e.details?.used ?? 0, to: '' }); else toast.error(errorMessage(e)); },
  });
  const ask = async (s: Status) => { if (await confirm({ title: 'Excluir status?', message: `Deseja realmente excluir o status "${s.name}"?`, confirmLabel: 'Excluir', danger: true })) del.mutate({ s }); };
  const move = (i: number, d: -1 | 1) => { const ids = list.map((s) => s.id); [ids[i], ids[i + d]] = [ids[i + d], ids[i]]; reorder.mutate(ids); };

  return (
    <section className="card">
      <div className="card-head"><h2>Status personalizados</h2><Button variant="primary" size="sm" onClick={() => setForm({})}><Plus size={14} /> Novo status</Button></div>
      <div className="card-pad col">
        <div className="seg" role="group" aria-label="Módulo" style={{ alignSelf: 'flex-start', flexWrap: 'wrap' }}>{SCOPES.map((s) => <button key={s.key} aria-pressed={scope === s.key} onClick={() => setScope(s.key)}>{s.label}</button>)}</div>
        <p className="muted small" style={{ margin: 0 }}>A ordem define as colunas do Kanban. A categoria define como o status entra nos relatórios e alertas.</p>
      </div>
      {all.isLoading ? <ListSkeleton rows={4} /> : (
        <div className="alist">{list.map((s, i) => { const K = KIND_META[s.kind]; return (
          <div key={s.id} className="aitem" style={{ cursor: 'default', alignItems: 'center' }}>
            <span className="dot" style={{ background: s.color ?? '#64748b', width: 14, height: 14 }} aria-hidden />
            <div className="aitem-main"><div className="aitem-title">{s.name}</div><div className="aitem-meta"><span className={`badge tone-${K.tone}`}><K.icon size={12} />{K.label}</span></div></div>
            <div className="row" style={{ gap: 2 }}>
              <button className="icon-btn" aria-label="Mover para cima" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={16} /></button>
              <button className="icon-btn" aria-label="Mover para baixo" disabled={i === list.length - 1} onClick={() => move(i, 1)}><ArrowDown size={16} /></button>
              <button className="icon-btn" aria-label={`Editar ${s.name}`} onClick={() => setForm({ status: s })}><Pencil size={16} /></button>
              <button className="icon-btn" aria-label={`Excluir ${s.name}`} onClick={() => ask(s)}><Trash2 size={16} /></button>
            </div>
          </div>); })}</div>)}
      {form && <StatusForm scope={scope} status={form.status} onClose={() => setForm(null)} />}
      {replace && (
        <Modal title="Status em uso" size="sm" onClose={() => setReplace(null)} footer={<><Button variant="ghost" onClick={() => setReplace(null)}>Cancelar</Button>
          <Button variant="danger" disabled={!replace.to} loading={del.isPending} onClick={() => del.mutate({ s: replace.status, to: Number(replace.to) })}>Substituir e excluir</Button></>}>
          <p className="muted" style={{ marginTop: 0 }}>“{replace.status.name}” está em uso por {replace.used} registro(s). Escolha para qual status eles serão movidos:</p>
          <Select aria-label="Status de substituição" value={replace.to} onChange={(e) => setReplace({ ...replace, to: e.target.value })}><option value="">Selecione…</option>{list.filter((s) => s.id !== replace.status.id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
        </Modal>)}
    </section>
  );
}
