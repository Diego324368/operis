import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Field, Input } from '../components/ui/Form';
import { Button } from '../components/ui/Button';
import { errorMessage } from '../utils/errors';

export default function LoginPage() {
  const { login } = useAuth(); const nav = useNavigate();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    if (!email.trim() || !password) { setError('Informe seu e-mail e senha.'); return; }
    setBusy(true);
    try { await login(email.trim(), password); nav('/', { replace: true }); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };
  return (
    <div className="login">
      <form className="card login-card col" style={{ gap: 16 }} onSubmit={submit} noValidate>
        <div className="brand" style={{ padding: 0 }}><span className="brand-mark"><CheckCircle2 size={19} /></span> Operis</div>
        <div><h1>Entrar</h1><p className="muted" style={{ margin: '4px 0 0' }}>Acesse seu centro de controle operacional.</p></div>
        {error && <div className="form-error" role="alert">{error}</div>}
        <Field label="E-mail" htmlFor="l-email"><Input id="l-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></Field>
        <Field label="Senha" htmlFor="l-pass"><Input id="l-pass" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <Button variant="primary" type="submit" loading={busy} style={{ height: 42 }}>Entrar</Button>
      </form>
    </div>
  );
}
