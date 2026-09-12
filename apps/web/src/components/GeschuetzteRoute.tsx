import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/** Leitet nicht angemeldete Nutzer zum Login. Zeigt währenddessen einen Ladezustand. */
export function GeschuetzteRoute({ children }: { children: ReactNode }) {
  const { person, laedt, benoetigtSetup } = useAuth();

  if (laedt) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Lädt …
      </div>
    );
  }

  if (benoetigtSetup) {
    return <Navigate to="/setup" replace />;
  }

  if (!person) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
