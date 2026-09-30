import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { clientsApi } from '../../api/services';
import type { Client } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, Input, Select, Textarea } from '../ui/Form';
import { useStatuses, useUsers } from '../../hooks/useLookups';
import { useToast } from '../../hooks/useToast';
import { errorMessage, fieldErrors } from '../../utils/errors';
import { ApiError } from '../../api/http';
import { maskPhone } from '../../utils/format';

interface Props { client?: Client; onClose: () => void; onSaved?: (c: Client) => void }

export function ClientForm({ client, onClose, onSaved }: Props) {
  const qc = useQueryClient(); const toast = useToast();
  const statuses = useStatuses('client'); const users = useUsers();
  const [f, setF] = useState({
    name: client?.name ?? '', trade_name: client?.trade_name ?? '', contact_name: client?.contact_name ?? '', phone: client?.phone ?? '',
    whatsapp: client?.whatsapp ?? '', email: client?.email ?? '', address: client?.address ?? '', city: client?.city ?? '', notes: client?.notes ?? '',
    status_id: client?.status_id ? String(client.status_id) : '', assignee_id: client?.assignee_id ? String(client.assignee_id) : '', is_favorite: client?.is_favorite ?? false,
  });
  const [dupWarn, setDupWarn] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));

  const save = useMutation({
    mutationFn: (force: boolean) => {
      const body = { ...f, status_id: f.status_id ? Number(f.status_id) : null, assignee_id: f.assignee_id ? Number(f.assignee_id) : null, force };
      return client ? clientsApi.update(client.id, body) : clientsApi.create(body);
    },
    onSuccess: (c) => { qc.invalidateQueries(); toast.success(client ? '✓ Cliente atualizado com sucesso.' : '✓ Cliente cadastrado com sucesso.'); onSaved?.(c); onClose(); },
    onError: (e) => { if (e instanceof ApiError && e.code === 'DUPLICATE_CLIENT') setDupWarn(e.message); else setDupWarn(null); },
  });
  const errs = fieldErrors(save.error);
  const generalError = save.error && !(save.error instanceof ApiError && (save.error.code === 'DUPLICATE_CLIENT' || save.error.fields)) ? errorMessage(save.error) : null;
  const submit = (e: React.FormEvent) => { e.preventDefault(); save.mutate(false); };

  return (
    <Modal title={client ? 'Editar cliente' : 'Novo cliente'} onClose={onClose} size="lg"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button>
        {dupWarn ? <Button variant="primary" loading={save.isPending} onClick={() => save.mutate(true)}>Cadastrar mesmo assim</Button>
          : <Button variant="primary" type="submit" form="client-form" loading={save.isPending}>Salvar cliente</Button>}</>}>
      <form id="client-form" onSubmit={submit} className="form-grid" noValidate>
        {generalError && <div className="form-error span-2">{generalError}</div>}
        {dupWarn && <div className="form-warn span-2">{dupWarn} Deseja cadastrar mesmo assim?</div>}
        <Field label="Nome / Razão social *" error={errs.name} className="span-2" htmlFor="c-name"><Input id="c-name" value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus maxLength={160} /></Field>
        <Field label="Nome fantasia" error={errs.trade_name} htmlFor="c-trade"><Input id="c-trade" value={f.trade_name} onChange={(e) => set('trade_name', e.target.value)} /></Field>
        <Field label="Responsável (contato)" error={errs.contact_name} htmlFor="c-contact"><Input id="c-contact" value={f.contact_name} onChange={(e) => set('contact_name', e.target.value)} /></Field>
        <Field label="Telefone" error={errs.phone} htmlFor="c-phone"><Input id="c-phone" inputMode="tel" placeholder="(11) 3456-7890" value={f.phone} onChange={(e) => set('phone', maskPhone(e.target.value))} /></Field>
        <Field label="WhatsApp" error={errs.whatsapp} htmlFor="c-wa"><Input id="c-wa" inputMode="tel" placeholder="(11) 98765-4321" value={f.whatsapp} onChange={(e) => set('whatsapp', maskPhone(e.target.value))} /></Field>
        <Field label="E-mail" error={errs.email} className="span-2" htmlFor="c-email"><Input id="c-email" type="email" inputMode="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Endereço" error={errs.address} htmlFor="c-addr"><Input id="c-addr" value={f.address} onChange={(e) => set('address', e.target.value)} /></Field>
        <Field label="Cidade" error={errs.city} htmlFor="c-city"><Input id="c-city" value={f.city} onChange={(e) => set('city', e.target.value)} /></Field>
        <Field label="Status" htmlFor="c-status">
          <Select id="c-status" value={f.status_id} onChange={(e) => set('status_id', e.target.value)}>
            {!client && <option value="">Padrão ({statuses.data?.[0]?.name ?? '…'})</option>}
            {statuses.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Responsável pelo atendimento" htmlFor="c-assignee">
          <Select id="c-assignee" value={f.assignee_id} onChange={(e) => set('assignee_id', e.target.value)}>
            <option value="">Eu mesmo</option>{users.data?.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
        </Field>
        <Field label="Observações rápidas" error={errs.notes} className="span-2" htmlFor="c-notes" hint="Ex.: prefere atendimento pela manhã; responsável é o João.">
          <Textarea id="c-notes" value={f.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
        <label className="checkbox span-2"><input type="checkbox" checked={f.is_favorite} onChange={(e) => set('is_favorite', e.target.checked)} /> Marcar como cliente importante (acesso rápido)</label>
      </form>
    </Modal>
  );
}
