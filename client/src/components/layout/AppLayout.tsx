import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, BarChart3, Building2, CalendarDays, CalendarCheck2, GraduationCap, LayoutDashboard, ListChecks, LogOut, Menu, PhoneCall, Plus, Search, Settings, TrendingUp, Wrench, CheckCircle2, Users } from 'lucide-react';
import { dashboardApi } from '../../api/services';
import { useAuth } from '../../hooks/useAuth';
import { Avatar } from '../ui/Badges';
import { Button } from '../ui/Button';
import { Dropdown } from '../ui/Dropdown';
import { GlobalSearch } from './GlobalSearch';
import { NotificationBell } from './NotificationBell';
import { useActivityModals } from '../activities/ActivityModals';
import { ClientForm } from '../clients/ClientForm';
import { ACTIVITY_META } from '../../utils/constants';
import type { ActivityType } from '../../types';

const NAV = [
  { section: 'Principal', items: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }, { to: '/hoje', label: 'Hoje', icon: CalendarCheck2 },
    { to: '/atrasados', label: 'Atrasados', icon: AlertTriangle, badge: true }, { to: '/agenda', label: 'Agenda', icon: CalendarDays } ] },
  { section: 'Operação', items: [
    { to: '/clientes', label: 'Clientes', icon: Building2 }, { to: '/instalacoes', label: 'Instalações', icon: Wrench },
    { to: '/treinamentos', label: 'Treinamentos', icon: GraduationCap }, { to: '/acompanhamentos', label: 'Acompanhamentos', icon: PhoneCall }, { to: '/tarefas', label: 'Tarefas', icon: ListChecks } ] },
  { section: 'Análise', items: [ { to: '/relatorios', label: 'Relatórios', icon: BarChart3 }, { to: '/produtividade', label: 'Produtividade', icon: TrendingUp } ] },
];

export function AppLayout() {
  const { user, logout } = useAuth(); const nav = useNavigate(); const loc = useLocation(); const modals = useActivityModals();
  const [drawer, setDrawer] = useState(false); const [search, setSearch] = useState(false); const [newClient, setNewClient] = useState(false);
  const dash = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.get, staleTime: 30_000 });
  const overdue = dash.data?.kpis.overdue ?? 0;

  useEffect(() => setDrawer(false), [loc.pathname]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearch(true); }
      if (e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); modals.openForm('task', {}, true); }
    };
    document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key);
  }, [modals]);

  const QuickAdd = (
    <>
      <div className="menu-label">Criar novo</div>
      <button onClick={() => setNewClient(true)}><Building2 size={15} /> Cliente</button>
      {(['installation', 'training', 'followup', 'task', 'meeting', 'event'] as ActivityType[]).map((t) => { const I = ACTIVITY_META[t].icon; return <button key={t} onClick={() => modals.openForm(t)}><I size={15} /> {ACTIVITY_META[t].label}</button>; })}
    </>
  );

  return (
    <div className="app">
      <div className={`drawer-back ${drawer ? 'open' : ''}`} onClick={() => setDrawer(false)} />
      <aside className={`sidebar ${drawer ? 'open' : ''}`} aria-label="Menu principal">
        <div className="brand"><span className="brand-mark"><CheckCircle2 size={19} /></span> Operis</div>
        {NAV.map((g) => (
          <nav key={g.section} aria-label={g.section}>
            <div className="nav-section">{g.section}</div>
            {g.items.map(({ to, label, icon: I, end, badge }: any) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><I size={18} />{label}{badge && overdue > 0 && <span className="nav-badge" aria-label={`${overdue} atrasadas`}>{overdue}</span>}</NavLink>
            ))}
          </nav>
        ))}
        <div className="spacer" />
        <NavLink to="/configuracoes" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Settings size={18} />Configurações</NavLink>
        <div className="row" style={{ padding: '10px 8px', borderTop: '1px solid var(--border)', marginTop: 6 }}>
          <Avatar name={user!.name} large /><div className="truncate" style={{ flex: 1 }}><div className="bold truncate">{user!.name}</div><div className="tiny muted">{user!.role === 'admin' ? 'Administrador' : 'Colaborador'}</div></div>
          <button className="icon-btn" aria-label="Sair" title="Sair" onClick={() => logout().then(() => nav('/login'))}><LogOut size={18} /></button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" aria-label="Abrir menu" onClick={() => setDrawer(true)}><Menu size={22} /></button>
          <button className="search-trigger" onClick={() => setSearch(true)} aria-label="Abrir busca global"><Search size={16} /><span className="truncate">Pesquisar cliente…</span><span className="kbd">Ctrl K</span></button>
          <span className="spacer" />
          <span className="hide-mobile-inline"><Dropdown align="right" trigger={<Button variant="primary"><Plus size={16} /> <span>Novo</span></Button>}>{QuickAdd}</Dropdown></span>
          <NotificationBell />
        </header>
        <main id="conteudo"><Outlet /></main>
      </div>
      <nav className="bottom-nav" aria-label="Navegação rápida">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}><LayoutDashboard size={20} />Início</NavLink>
        <NavLink to="/hoje" className={({ isActive }) => (isActive ? 'active' : '')}><CalendarCheck2 size={20} />Hoje</NavLink>
        <Dropdown label="Criar novo" up align="center" trigger={<button className="fab" aria-label="Criar novo"><span className="fab-icon"><Plus size={24} /></span></button>}>{QuickAdd}</Dropdown>
        <NavLink to="/agenda" className={({ isActive }) => (isActive ? 'active' : '')}><CalendarDays size={20} />Agenda</NavLink>
        <button onClick={() => setDrawer(true)}><Users size={20} />Mais</button>
      </nav>
      {search && <GlobalSearch onClose={() => setSearch(false)} />}
      {newClient && <ClientForm onClose={() => setNewClient(false)} onSaved={(c) => nav(`/clientes/${c.id}`)} />}
    </div>
  );
}
