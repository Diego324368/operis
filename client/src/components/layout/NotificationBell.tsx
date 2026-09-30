import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlarmClock, Bell, CalendarClock, CalendarDays, AlertTriangle, PhoneCall } from 'lucide-react';
import { notificationsApi } from '../../api/services';
import { useSettings } from '../../hooks/useLookups';
import { useActivityModals } from '../activities/ActivityModals';
import { fmtDateTime } from '../../utils/date';
import { Button } from '../ui/Button';

const ICON: Record<string, typeof Bell> = { overdue: AlertTriangle, soon: AlarmClock, today: CalendarDays, tomorrow: CalendarClock, no_followup: PhoneCall };
const TONE: Record<string, string> = { overdue: 'red', soon: 'amber', today: 'blue', tomorrow: 'gray', no_followup: 'yellow' };

export function NotificationBell() {
  const qc = useQueryClient(); const nav = useNavigate(); const modals = useActivityModals(); const settings = useSettings();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const seen = useRef<Set<number> | null>(null);
  const q = useQuery({ queryKey: ['notifications'], queryFn: notificationsApi.list, refetchInterval: 60_000, refetchIntervalInBackground: true });
  const read = useMutation({ mutationFn: notificationsApi.read, onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
  const readAll = useMutation({ mutationFn: notificationsApi.readAll, onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });

  // Notificações do navegador para itens novos (se permitido pelo usuário e pelas configurações)
  useEffect(() => {
    const items = q.data?.items; if (!items) return;
    if (seen.current === null) { seen.current = new Set(items.map((i) => i.id)); return; }
    const fresh = items.filter((i) => !seen.current!.has(i.id) && !i.read_at);
    items.forEach((i) => seen.current!.add(i.id));
    if (settings.data?.browser_notifications && typeof Notification !== 'undefined' && Notification.permission === 'granted')
      fresh.slice(0, 3).forEach((n) => { try { new Notification(n.title, { body: n.message, tag: `operis-${n.id}` }); } catch { /* ignora */ } });
  }, [q.data, settings.data?.browser_notifications]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const unread = q.data?.unread ?? 0;
  const canAsk = typeof Notification !== 'undefined' && Notification.permission === 'default';
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="icon-btn" aria-label={`Notificações${unread ? `, ${unread} não lidas` : ''}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Bell size={20} />{unread > 0 && <span className="nav-badge" style={{ position: 'absolute', top: -2, right: -2, padding: '0 5px' }}>{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="card menu notif-panel" style={{ padding: 0 }} role="dialog" aria-label="Notificações">
          <div className="card-head"><b>Notificações</b><Button size="sm" variant="ghost" disabled={!unread} onClick={() => readAll.mutate()}>Marcar todas como lidas</Button></div>
          {canAsk && <div className="form-warn" style={{ margin: 10 }}>Ative os alertas do navegador para ser avisado mesmo em outra aba. <Button size="sm" onClick={() => Notification.requestPermission().then(() => qc.invalidateQueries({ queryKey: ['notifications'] }))}>Ativar</Button></div>}
          {q.data?.items.length === 0 && <p className="muted center" style={{ padding: 24, margin: 0 }}>Nenhuma notificação por enquanto.</p>}
          {q.data?.items.map((n) => {
            const I = ICON[n.kind] ?? Bell;
            return (
              <button key={n.id} className={`notif-item ${n.read_at ? '' : 'unread'}`} onClick={() => { read.mutate(n.id); setOpen(false); if (n.activity_id) modals.openDetail(n.activity_id); else if (n.client_id) nav(`/clientes/${n.client_id}`); }}>
                <span className={`aitem-icon tone-${TONE[n.kind] ?? 'gray'}`} style={{ width: 30, height: 30 }}><I size={16} /></span>
                <span style={{ flex: 1, minWidth: 0 }}><b>{n.title}</b><br /><span className="small muted">{n.message}</span><br /><span className="tiny muted">{fmtDateTime(n.created_at)}</span></span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
