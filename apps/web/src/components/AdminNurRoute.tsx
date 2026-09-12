import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Blendet Admin-Bereiche für Nicht-Admins aus (Komfort). Die echte Absicherung
 * bleiben die serverseitigen Guards — Sichtbarkeit ist NICHT Autorisierung.
 */
export function AdminNurRoute({ children }: { children: ReactNode }) {
  const { person } = useAuth();
  if (!person?.istAdmin) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
