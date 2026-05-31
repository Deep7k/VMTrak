import { RouterProvider } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { router } from './router';

function App() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950">
        <div className="text-slate-400 font-mono">Loading...</div>
      </div>
    );
  }

  return <RouterProvider router={router} />;
}

export default App;
