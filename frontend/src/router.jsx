import { createBrowserRouter } from 'react-router-dom';
import Login        from './pages/Login';
import SetupPage    from './pages/SetupPage';
import AppShell     from './components/AppShell';
import VMList       from './pages/VMList';
import VMDetail     from './pages/VMDetail';
import VMForm       from './pages/VMForm';
import UsersPage    from './pages/Users';
import AuditPage    from './pages/Audit';
import DashboardPage from './pages/Dashboard';
import { RequireAuth, RequireAdmin, RequireSetup } from './components/Guards';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/setup',
    element: <RequireSetup><SetupPage /></RequireSetup>,
  },
  {
    path: '/',
    element: <RequireAuth><AppShell /></RequireAuth>,
    children: [
      { index: true,           element: <VMList /> },
      { path: '/dashboard',    element: <DashboardPage /> },
      { path: '/vms',          element: <VMList /> },
      { path: '/vms/new',      element: <RequireAdmin><VMForm /></RequireAdmin> },
      { path: '/vms/:id',      element: <VMDetail /> },
      { path: '/vms/:id/edit', element: <RequireAdmin><VMForm /></RequireAdmin> },
      { path: '/users',        element: <RequireAdmin><UsersPage /></RequireAdmin> },
      { path: '/audit',        element: <RequireAdmin><AuditPage /></RequireAdmin> },
    ],
  },
]);
