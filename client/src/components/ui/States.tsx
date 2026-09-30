import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertCircle, Inbox } from 'lucide-react';
import { Button } from './Button';
import { errorMessage } from '../../utils/errors';

export function EmptyState({ icon: Icon = Inbox, title, text, action }: { icon?: LucideIcon; title: string; text?: string; action?: ReactNode }) {
  return <div className="empty"><Icon size={36} aria-hidden /><h3>{title}</h3>{text && <p style={{ margin: 0 }}>{text}</p>}{action}</div>;
}
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="state-error"><AlertCircle size={32} /><p>{errorMessage(error)}</p>{onRetry && <Button onClick={onRetry}>Tentar novamente</Button>}</div>
  );
}
export const Skeleton = ({ h = 16, w = '100%', style }: { h?: number; w?: number | string; style?: React.CSSProperties }) => <div className="skeleton" style={{ height: h, width: w, ...style }} aria-hidden />;
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return <div className="col" style={{ padding: 16, gap: 14 }} role="status" aria-label="Carregando">{Array.from({ length: rows }, (_, i) => <Skeleton key={i} h={44} />)}</div>;
}
