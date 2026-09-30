import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil } from 'lucide-react';
import { usersApi } from '../../api/services';
import type { User } from '../../types';
import { useUsers } from '../../hooks/useLookups';
import { useToast } from '../../hooks/useToast';
import { errorMessage, fieldErrors } from '../../utils/errors';
import { Avatar } from '../ui/Badges';
import { Button } from '../ui/Button';
import { Field, Input, Select } from '../ui/Form';
import { Modal } from '../ui/Modal';
import { ListSkeleton } from '../ui/States';

function UserForm({ user, onClose }: { user?: User; onClose: () => void }) {
  const qc = useQueryClient(); const toast = useToast();
  const [f, setF] = useState({ name: user?.name ?? '', email: user?.email ?? '', password: '', role: user?.role ?? 'member', active: user ? !!user.active : true });
  const save = useMutation({
    mutationFn: () => user ? usersApi.update(user.id, { name: f.name, email: f.email, role: f.role, active: f.active, ...(f.password ? { password: f.password } : {}) }) : usersApi.create({ name: f.name, email: f.email, password: f.password, role: f.role }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success(user ? '✓ Usuário atualizado.' : '✓ Usuário criado.'); onClose(); },
  });
  const errs = fieldErrors(save.error); const general = save.error && !Object.keys(errs).length ? errorMessage(save.error) : null;
  return (
    <Modal title={user ? 'Editar usuário' : 'Novo usuário'} onClose={onClose} size="sm" footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" type="submit" form="user-form" loading={save.isPending}>Salvar</Button></>}>
      <form id="user-form" className="col" style={{ gap: 14 }} onSubmit={(e) => { e.preventDefault(); save.mutate(); }} noValidate>
        {general && <div className="form-error">{general}</div>}
        <Field label="Nome" error={errs.name} htmlFor="u-name"><Input id="u-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus /></Field>
        <Field label="E-mail" error={errs.email} htmlFor="u-email"><Input id="u-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label={user ? 'Nova senha (opcional)' : 'Senha'} error={errs.password} htmlFor="u-pass"><Input id="u-pass" type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <Field label="Nível de acesso" htmlFor="u-role" hint="Colaborador vê apenas as atividades atribuídas a ele.">
          <Select id="u-role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as User['role'] })}><option value="member">Colaborador</option><option value="admin">Administrador</option></Select>
        </Field>
        {user && <label className="checkbox"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Usuário ativo</label>}
      </form>
    </Modal>
  );
}

export function UsersSettings() {
  const users = useUsers(); const [form, setForm] = useState<{ user?: User } | null>(null);
  return (
    <section className="card">
      <div className="card-head"><h2>Usuários</h2><Button variant="primary" size="sm" onClick={() => setForm({})}><Plus size={14} /> Novo usuário</Button></div>
      {users.isLoading ? <ListSkeleton rows={3} /> : <div className="alist">{users.data?.map((u) => (
        <div key={u.id} className="aitem" style={{ cursor: 'default', alignItems: 'center', opacity: u.active ? 1 : .55 }}>
          <Avatar name={u.name} large /><div className="aitem-main"><div className="aitem-title">{u.name} {!u.active && <span className="badge tone-gray">Inativo</span>}</div><div className="aitem-meta">{u.email} · {u.role === 'admin' ? 'Administrador' : 'Colaborador'}</div></div>
          <Button size="sm" onClick={() => setForm({ user: u })} aria-label={`Editar ${u.name}`}><Pencil size={14} /> Editar</Button>
        </div>))}</div>}
      {form && <UserForm user={form.user} onClose={() => setForm(null)} />}
    </section>
  );
}
