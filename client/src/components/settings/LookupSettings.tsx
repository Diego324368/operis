import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { lookupApi } from '../../api/services';
import type { Lookup } from '../../types';
import { useToast } from '../../hooks/useToast';
import { useConfirm } from '../../hooks/useConfirm';
import { errorMessage } from '../../utils/errors';
import { Button } from '../ui/Button';
import { ListSkeleton } from '../ui/States';

/** Lista editável de itens de apoio (tipos de treinamento / categorias de tarefas). */
export function LookupSettings({ path, title, noun }: { path: 'training-types' | 'task-categories'; title: string; noun: string }) {
  const api = lookupApi(path); const qc = useQueryClient(); const toast = useToast(); const confirm = useConfirm();
  const key = [path, 'all'];
  const q = useQuery({ queryKey: key, queryFn: () => api.list(true) });
  const [name, setName] = useState(''); const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);
  const done = (msg: string) => { qc.invalidateQueries({ queryKey: [path] }); toast.success(msg); };
  const add = useMutation({ mutationFn: () => api.create(name.trim()), onSuccess: () => { setName(''); done(`✓ ${noun} criado.`); }, onError: (e) => toast.error(errorMessage(e)) });
  const rename = useMutation({ mutationFn: () => api.update(editing!.id, { name: editing!.name.trim() }), onSuccess: () => { setEditing(null); done('✓ Nome atualizado.'); }, onError: (e) => toast.error(errorMessage(e)) });
  const toggle = useMutation({ mutationFn: (i: Lookup) => api.update(i.id, { name: i.name, active: !i.active }), onSuccess: () => done('✓ Atualizado.'), onError: (e) => toast.error(errorMessage(e)) });
  const remove = useMutation({ mutationFn: (i: Lookup) => api.remove(i.id), onSuccess: (r) => done(r.deactivated ? '✓ Item em uso: foi desativado para preservar o histórico.' : '✓ Item excluído.'), onError: (e) => toast.error(errorMessage(e)) });
  const ask = async (i: Lookup) => { if (await confirm({ title: `Excluir ${noun.toLowerCase()}?`, message: `Deseja realmente excluir "${i.name}"? Se já estiver em uso, ele será apenas desativado.`, confirmLabel: 'Excluir', danger: true })) remove.mutate(i); };
  return (
    <section className="card">
      <div className="card-head"><h2>{title}</h2></div>
      <form className="row card-pad" onSubmit={(e) => { e.preventDefault(); if (name.trim()) add.mutate(); }}>
        <input className="input" placeholder={`Novo ${noun.toLowerCase()}…`} aria-label={`Novo ${noun.toLowerCase()}`} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        <Button variant="primary" type="submit" disabled={!name.trim()} loading={add.isPending}><Plus size={15} /> Adicionar</Button>
      </form>
      {q.isLoading ? <ListSkeleton rows={4} /> : <div className="alist">{q.data?.map((i) => (
        <div key={i.id} className="aitem" style={{ cursor: 'default', alignItems: 'center', opacity: i.active ? 1 : .55 }}>
          {editing?.id === i.id ? (
            <form className="row" style={{ flex: 1 }} onSubmit={(e) => { e.preventDefault(); rename.mutate(); }}><input className="input" autoFocus aria-label="Novo nome" value={editing.name} onChange={(e) => setEditing({ id: i.id, name: e.target.value })} /><Button size="sm" variant="primary" type="submit">Salvar</Button><Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button></form>
          ) : (<>
            <div className="aitem-main"><span className="aitem-title">{i.name}</span> {!i.active && <span className="badge tone-gray">Inativo</span>}</div>
            <Button size="sm" variant="ghost" onClick={() => toggle.mutate(i)}>{i.active ? 'Desativar' : 'Reativar'}</Button>
            <button className="icon-btn" aria-label={`Renomear ${i.name}`} onClick={() => setEditing({ id: i.id, name: i.name })}><Pencil size={16} /></button>
            <button className="icon-btn" aria-label={`Excluir ${i.name}`} onClick={() => ask(i)}><Trash2 size={16} /></button>
          </>)}
        </div>))}</div>}
    </section>
  );
}
