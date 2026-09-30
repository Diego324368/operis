import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../../api/services';
import type { Settings } from '../../types';
import { useSettings } from '../../hooks/useLookups';
import { useToast } from '../../hooks/useToast';
import { errorMessage } from '../../utils/errors';
import { Button } from '../ui/Button';
import { Field, Input } from '../ui/Form';
import { ListSkeleton } from '../ui/States';

/** Preferências gerais e de notificações (somente administradores podem salvar). */
export function PreferencesSettings({ canEdit }: { canEdit: boolean }) {
  const q = useSettings(); const qc = useQueryClient(); const toast = useToast();
  const [f, setF] = useState<Settings | null>(null);
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'denied');
  useEffect(() => { if (q.data) setF(q.data); }, [q.data]);
  const save = useMutation({ mutationFn: () => settingsApi.update(f!), onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); toast.success('✓ Configurações salvas.'); }, onError: (e) => toast.error(errorMessage(e)) });
  if (!f) return <ListSkeleton rows={4} />;
  const num = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: Number(e.target.value) });
  return (
    <form className="col" style={{ gap: 16, maxWidth: 720 }} onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      {!canEdit && <div className="form-warn">Apenas administradores podem alterar as configurações gerais.</div>}
      <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0 }} className="col">
        <section className="card card-pad form-grid"><h2 className="span-2">Geral</h2>
          <Field label="Nome da empresa (aparece nos relatórios)" className="span-2" htmlFor="g-co"><Input id="g-co" value={f.company_name} onChange={(e) => setF({ ...f, company_name: e.target.value })} /></Field>
          <Field label="Duração padrão de uma atividade (min)" htmlFor="g-dur" hint="Usada para detectar conflitos quando não há horário final."><Input id="g-dur" type="number" min={15} max={600} step={15} value={f.default_duration_minutes} onChange={num('default_duration_minutes')} /></Field>
        </section>
        <section className="card card-pad form-grid"><h2 className="span-2">Notificações e alertas</h2>
          <Field label="Lembrar com antecedência de (min)" htmlFor="n-lead"><Input id="n-lead" type="number" min={5} max={1440} value={f.reminder_lead_minutes} onChange={num('reminder_lead_minutes')} /></Field>
          <Field label="Alertar cliente sem acompanhamento após (dias)" htmlFor="n-days"><Input id="n-days" type="number" min={1} max={365} value={f.no_followup_days} onChange={num('no_followup_days')} /></Field>
          <label className="checkbox span-2"><input type="checkbox" checked={f.browser_notifications} onChange={(e) => setF({ ...f, browser_notifications: e.target.checked })} /> Exibir notificações do navegador</label>
        </section>
      </fieldset>
      <section className="card card-pad"><h2 style={{ marginBottom: 8 }}>Notificações neste navegador</h2>
        {perm === 'granted' && <p className="muted" style={{ margin: 0 }}>✓ Permitidas. Você receberá avisos enquanto o Operis estiver aberto.</p>}
        {perm === 'denied' && <p className="muted" style={{ margin: 0 }}>Bloqueadas pelo navegador. Libere nas configurações do site para receber avisos.</p>}
        {perm === 'default' && <Button onClick={() => Notification.requestPermission().then(setPerm)}>Permitir notificações do navegador</Button>}
      </section>
      {canEdit && <div className="row" style={{ justifyContent: 'flex-end' }}><Button variant="primary" type="submit" loading={save.isPending}>Salvar configurações</Button></div>}
    </form>
  );
}
