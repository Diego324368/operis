import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { ProfileSettings } from '../components/settings/ProfileSettings';
import { UsersSettings } from '../components/settings/UsersSettings';
import { StatusSettings } from '../components/settings/StatusSettings';
import { LookupSettings } from '../components/settings/LookupSettings';
import { PreferencesSettings } from '../components/settings/PreferencesSettings';

type Tab = 'perfil' | 'usuarios' | 'status' | 'treinamentos' | 'categorias' | 'preferencias';

export default function SettingsPage() {
  const { isAdmin } = useAuth();
  const tabs: [Tab, string, boolean][] = [['perfil', 'Dados pessoais', true], ['usuarios', 'Usuários', isAdmin], ['status', 'Status', isAdmin], ['treinamentos', 'Tipos de treinamento', isAdmin], ['categorias', 'Categorias de tarefas', isAdmin], ['preferencias', 'Preferências e notificações', true]];
  const [tab, setTab] = useState<Tab>('perfil');
  return (
    <div className="page">
      <div className="page-header"><div><h1>Configurações</h1><p>Personalize o sistema conforme o seu processo.</p></div></div>
      <div className="tabs" role="tablist">{tabs.filter(([, , ok]) => ok).map(([k, l]) => <button key={k} className="tab" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'perfil' && <ProfileSettings />}
      {tab === 'usuarios' && <UsersSettings />}
      {tab === 'status' && <StatusSettings />}
      {tab === 'treinamentos' && <LookupSettings path="training-types" title="Tipos de treinamento" noun="Tipo" />}
      {tab === 'categorias' && <LookupSettings path="task-categories" title="Categorias de tarefas" noun="Categoria" />}
      {tab === 'preferencias' && <PreferencesSettings canEdit={isAdmin} />}
    </div>
  );
}
