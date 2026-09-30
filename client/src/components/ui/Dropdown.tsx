import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Menu suspenso simples; fecha ao clicar fora, Esc ou ao escolher um item. */
export function Dropdown({ trigger, children, align = 'left', up = false, label }: { trigger: ReactNode; children: ReactNode; align?: 'left' | 'right' | 'center'; up?: boolean; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', click); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', click); document.removeEventListener('keydown', key); };
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <span onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }} role="button" aria-haspopup="menu" aria-expanded={open} aria-label={label} tabIndex={-1} style={{ display: 'contents' }}>{trigger}</span>
      {open && <div className="menu" role="menu" style={{ ...(align === 'center' ? { left: '50%', transform: 'translateX(-50%)' } : { [align]: 0 }), ...(up ? { bottom: 'calc(100% + 12px)' } : { top: 'calc(100% + 4px)' }) }} onClick={(e) => { e.stopPropagation(); setOpen(false); }}>{children}</div>}
    </div>
  );
}
