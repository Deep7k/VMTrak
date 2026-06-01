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
import { RequireAuth, RequireAdmin, RequireReadWrite, RequireSetup } from './components/Guards';

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
      { path: '/dashboard',    element: <RequireReadWrite><DashboardPage /></RequireReadWrite> },
      { path: '/vms',          element: <VMList /> },
      { path: '/vms/new',      element: <RequireReadWrite><VMForm /></RequireReadWrite> },
      { path: '/vms/:id',      element: <VMDetail /> },
      { path: '/vms/:id/edit', element: <RequireReadWrite><VMForm /></RequireReadWrite> },
      { path: '/users',        element: <RequireAdmin><UsersPage /></RequireAdmin> },
      { path: '/audit',        element: <RequireAdmin><AuditPage /></RequireAdmin> },
    ],
  },
]);
