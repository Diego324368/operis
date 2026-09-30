import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '../../api/services';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { errorMessage, fieldErrors } from '../../utils/errors';
import { Button } from '../ui/Button';
import { Field, Input } from '../ui/Form';

export function ProfileSettings() {
  const { user, setUser } = useAuth(); const toast = useToast();
  const [f, setF] = useState({ name: user!.name, email: user!.email, current_password: '', new_password: '' });
  const save = useMutation({
    mutationFn: () => authApi.updateProfile({ name: f.name, email: f.email, ...(f.new_password ? { current_password: f.current_password, new_password: f.new_password } : {}) }),
    onSuccess: (r) => { setUser(r.user); setF((s) => ({ ...s, current_password: '', new_password: '' })); toast.success('✓ Dados pessoais atualizados.'); },
  });
  const errs = fieldErrors(save.error); const general = save.error && !Object.keys(errs).length ? errorMessage(save.error) : null;
  return (
    <form className="card card-pad form-grid" style={{ maxWidth: 640 }} onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <h2 className="span-2">Dados pessoais</h2>
      {general && <div className="form-error span-2">{general}</div>}
      <Field label="Nome" error={errs.name} htmlFor="p-name"><Input id="p-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="E-mail" error={errs.email} htmlFor="p-email"><Input id="p-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
      <h3 className="span-2" style={{ marginTop: 6 }}>Alterar senha</h3>
      <Field label="Senha atual" htmlFor="p-cur"><Input id="p-cur" type="password" autoComplete="current-password" value={f.current_password} onChange={(e) => setF({ ...f, current_password: e.target.value })} /></Field>
      <Field label="Nova senha" error={errs.new_password} htmlFor="p-new" hint="Mínimo de 6 caracteres."><Input id="p-new" type="password" autoComplete="new-password" value={f.new_password} onChange={(e) => setF({ ...f, new_password: e.target.value })} /></Field>
      <div className="span-2 row" style={{ justifyContent: 'flex-end' }}><Button variant="primary" type="submit" loading={save.isPending}>Salvar</Button></div>
    </form>
  );
}
