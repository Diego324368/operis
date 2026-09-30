import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, History, Search } from 'lucide-react';
import { searchApi } from '../../api/services';
import { useDebounce } from '../../hooks/useDebounce';
import { ACTIVITY_META } from '../../utils/constants';
import { fmtDate } from '../../utils/date';
import { useActivityModals } from '../activities/ActivityModals';
import { StatusBadge } from '../ui/Badges';
import { Skeleton } from '../ui/States';

type Item = { key: string; group: string; run: () => void; node: React.ReactNode };

export function GlobalSearch({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState(''); const [sel, setSel] = useState(0);
  const term = useDebounce(text.trim(), 250);
  const nav = useNavigate(); const modals = useActivityModals();
  const inputRef = useRef<HTMLInputElement>(null);
  const q = useQuery({ queryKey: ['search', term], queryFn: () => searchApi.search(term), enabled: term.length >= 2 });

  useEffect(() => { inputRef.current?.focus(); const p = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = p; }; }, []);

  const items = useMemo<Item[]>(() => {
    const d = q.data; if (!d) return [];
    const go = (fn: () => void) => () => { onClose(); fn(); };
    return [
      ...d.clients.map((c) => ({ key: `c${c.id}`, group: 'Clientes', run: go(() => nav(`/clientes/${c.id}`)),
        node: <><Building2 size={16} /><div className="truncate" style={{ flex: 1 }}><b>{c.name}</b><div className="tiny muted">{[c.city, c.phone ?? c.whatsapp].filter(Boolean).join(' · ')}</div></div><StatusBadge kind={c.status_kind} name={c.status_name} /></> })),
      ...d.activities.map((a) => { const I = ACTIVITY_META[a.type].icon; return { key: `a${a.id}`, group: 'Atividades', run: go(() => modals.openDetail(a.id)),
        node: <><I size={16} style={{ color: ACTIVITY_META[a.type].color }} /><div className="truncate" style={{ flex: 1 }}><b>{a.title}</b><div className="tiny muted">{a.type_label} · {fmtDate(a.date)}{a.start_time ? ` ${a.start_time}` : ''}</div></div><StatusBadge kind={a.status_kind} name={a.status_name} overdue={a.is_overdue} /></> }; }),
      ...d.history.map((h) => ({ key: `h${h.id}`, group: 'Histórico', run: go(() => nav(`/clientes/${h.client_id}`)),
        node: <><History size={16} /><div className="truncate" style={{ flex: 1 }}><b>{h.client_name}</b><div className="tiny muted truncate">{h.description} · {fmtDate(h.occurred_at.slice(0, 10))}</div></div></> })),
    ];
  }, [q.data, nav, modals, onClose]);

  useEffect(() => setSel(0), [items.length]);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter') items[sel]?.run();
  };
  let last = '';
  return createPortal(
    <div className="overlay palette" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} onKeyDown={onKey}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Busca global">
        <input ref={inputRef} className="palette-input" placeholder="Pesquisar cliente, telefone, cidade, data (dd/mm), tipo…" aria-label="Pesquisar" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="modal-body" style={{ padding: 8, minHeight: 80 }}>
          {term.length < 2 && <p className="muted center" style={{ margin: 20 }}><Search size={16} style={{ verticalAlign: -3 }} /> Digite ao menos 2 letras. Use ↑ ↓ e Enter.</p>}
          {q.isFetching && !q.data && <div className="col" style={{ padding: 8 }}><Skeleton h={38} /><Skeleton h={38} /></div>}
          {term.length >= 2 && q.data && items.length === 0 && <p className="muted center" style={{ margin: 20 }}>Nenhum resultado para “{term}”.</p>}
          {items.map((it, i) => {
            const head = it.group !== last; last = it.group;
            return (<div key={it.key}>{head && <div className="pres-group">{it.group}</div>}
              <button className={`pres ${i === sel ? 'sel' : ''}`} onClick={it.run} onMouseEnter={() => setSel(i)}>{it.node}</button></div>);
          })}
        </div>
      </div>
    </div>, document.body);
}
