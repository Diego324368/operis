import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type Tone = 'success' | 'error' | 'info';
interface Toast { id: number; tone: Tone; text: string }
interface Ctx { success: (t: string) => void; error: (t: string) => void; info: (t: string) => void }
const ToastCtx = createContext<Ctx>(null!);
export const useToast = () => useContext(ToastCtx);
let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const remove = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback((tone: Tone, text: string) => {
    const id = ++seq;
    setItems((l) => [...l.slice(-3), { id, tone, text }]);
    setTimeout(() => remove(id), tone === 'error' ? 6000 : 3500);
  }, [remove]);
  const api: Ctx = { success: (t) => push('success', t), error: (t) => push('error', t), info: (t) => push('info', t) };
  const Icon = { success: CheckCircle2, error: AlertCircle, info: Info };
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => {
          const I = Icon[t.tone];
          return (
            <div key={t.id} className={`toast toast-${t.tone}`}>
              <I size={18} /> <span>{t.text}</span>
              <button className="icon-btn" aria-label="Fechar" onClick={() => remove(t.id)}><X size={14} /></button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
