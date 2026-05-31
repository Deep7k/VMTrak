import { createBrowserRouter } from 'react-router-dom';
import Login          from './pages/Login';
import AppShell       from './components/AppShell';
import VMList         from './pages/VMList';
import VMDetail       from './pages/VMDetail';
import VMForm         from './pages/VMForm';
import CredentialsPage from './pages/Credentials';
import UsersPage      from './pages/Users';
import AuditPage      from './pages/Audit';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true,           element: <VMList /> },
      { path: '/dashboard',    element: <div className="p-6 text-slate-400 font-mono">Dashboard — Coming soon</div> },
      { path: '/vms',          element: <VMList /> },
      { path: '/vms/new',      element: <VMForm /> },
      { path: '/vms/:id',      element: <VMDetail /> },
      { path: '/vms/:id/edit', element: <VMForm /> },
      { path: '/credentials',  element: <CredentialsPage /> },
      { path: '/users',        element: <UsersPage /> },
      { path: '/audit',        element: <AuditPage /> },
    ],
  },
]);
