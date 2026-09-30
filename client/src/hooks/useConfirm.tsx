import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';

interface Opts { title: string; message?: ReactNode; confirmLabel?: string; danger?: boolean }
const Ctx = createContext<(o: Opts) => Promise<boolean>>(null!);
export const useConfirm = () => useContext(Ctx);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<Opts | null>(null);
  const resolver = useRef<((v: boolean) => void) | undefined>(undefined);
  const confirm = useCallback((o: Opts) => new Promise<boolean>((res) => { resolver.current = res; setOpts(o); }), []);
  const close = (v: boolean) => { resolver.current?.(v); setOpts(null); };
  return (
    <Ctx.Provider value={confirm}>
      {children}
      {opts && (
        <Modal title={opts.title} onClose={() => close(false)} size="sm"
          footer={<><Button variant="ghost" onClick={() => close(false)}>Cancelar</Button>
            <Button variant={opts.danger ? 'danger' : 'primary'} autoFocus onClick={() => close(true)}>{opts.confirmLabel ?? 'Confirmar'}</Button></>}>
          {opts.message && <div className="muted">{opts.message}</div>}
        </Modal>
      )}
    </Ctx.Provider>
  );
}
