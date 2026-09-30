import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { AppLayout } from './components/layout/AppLayout';
import { ActivityModalsProvider } from './components/activities/ActivityModals';
import { ListSkeleton } from './components/ui/States';
import { KANBAN_ROUTES } from './utils/constants';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import KanbanPage from './pages/KanbanPage';

const ClientsPage = lazy(() => import('./pages/ClientsPage'));
const ClientDetailPage = lazy(() => import('./pages/ClientDetailPage'));
const AgendaPage = lazy(() => import('./pages/AgendaPage'));
const ListPage = lazy(() => import('./pages/ListPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const ProductivityPage = lazy(() => import('./pages/ProductivityPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="page"><ListSkeleton rows={5} /></div>;
  if (!user) return <Routes><Route path="/login" element={<LoginPage />} /><Route path="*" element={<Navigate to="/login" replace />} /></Routes>;
  return (
    <ActivityModalsProvider>
      <Suspense fallback={<div className="page"><ListSkeleton rows={5} /></div>}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="hoje" element={<ListPage mode="today" />} />
            <Route path="atrasados" element={<ListPage mode="overdue" />} />
            <Route path="agenda" element={<AgendaPage />} />
            <Route path="clientes" element={<ClientsPage />} />
            <Route path="clientes/:id" element={<ClientDetailPage />} />
            {Object.keys(KANBAN_ROUTES).map((p) => <Route key={p} path={p} element={<KanbanPage type={KANBAN_ROUTES[p]} />} />)}
            <Route path="relatorios" element={<ReportsPage />} />
            <Route path="produtividade" element={<ProductivityPage />} />
            <Route path="configuracoes" element={<SettingsPage />} />
            <Route path="login" element={<Navigate to="/" replace />} />
            <Route path="*" element={<div className="page"><h1>Página não encontrada</h1><p className="muted">O endereço acessado não existe.</p></div>} />
          </Route>
        </Routes>
      </Suspense>
    </ActivityModalsProvider>
  );
}
