import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, type ReactNode } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Spinner, ToastProvider } from '@soziolog/ui';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GeschuetzteRoute } from './components/GeschuetzteRoute';
import { AppShell } from './components/AppShell';
import { DemoBanner } from './components/DemoBanner';
import { AdminNurRoute } from './components/AdminNurRoute';
import { DomaenenKarte } from './pages/DomaenenKarte';
import { LoginSeite } from './pages/LoginSeite';
import { PasswortVergessenSeite } from './pages/PasswortVergessenSeite';
import { PasswortZuruecksetzenSeite } from './pages/PasswortZuruecksetzenSeite';
import { KontoSeite } from './pages/KontoSeite';
import { SetupWizard } from './pages/SetupWizard';
import { EinladungSeite } from './pages/EinladungSeite';
import { DomaenenLog } from './pages/DomaenenLog';
import { AdminVerwaltungSeite } from './pages/AdminVerwaltungSeite';
import { KorrekturenLogSeite } from './pages/KorrekturenLogSeite';

// Gesamt-Log & Statistik nachladen (ziehen recharts/Gantt in eigene Chunks).
const GesamtLog = lazy(() =>
  import('./pages/GesamtLog').then((m) => ({ default: m.GesamtLog })),
);
const Statistik = lazy(() =>
  import('./pages/Statistik').then((m) => ({ default: m.Statistik })),
);
import { DesignSystemSeite } from './pages/DesignSystemSeite';

function SetupRoute() {
  const { benoetigtSetup, laedt } = useAuth();
  if (laedt) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-leise">Lädt …</div>
    );
  }
  return benoetigtSetup ? <SetupWizard /> : <Navigate to="/login" replace />;
}

function OhneSetup({ children }: { children: ReactNode }) {
  const { benoetigtSetup, laedt } = useAuth();
  if (!laedt && benoetigtSetup) {
    return <Navigate to="/setup" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <DemoBanner />
            <Routes>
              {/* Öffentliche Design-Vorschau */}
              <Route path="/designsystem" element={<DesignSystemSeite />} />
              {/* Setup & Auth (ohne Shell) */}
              <Route path="/setup" element={<SetupRoute />} />
              <Route path="/einladung/:token" element={<EinladungSeite />} />
              <Route
                path="/login"
                element={
                  <OhneSetup>
                    <LoginSeite />
                  </OhneSetup>
                }
              />
              <Route
                path="/passwort-vergessen"
                element={
                  <OhneSetup>
                    <PasswortVergessenSeite />
                  </OhneSetup>
                }
              />
              <Route
                path="/passwort-zuruecksetzen"
                element={<PasswortZuruecksetzenSeite />}
              />
              {/* Geschützter Bereich mit App-Shell */}
              <Route
                element={
                  <GeschuetzteRoute>
                    <AppShell />
                  </GeschuetzteRoute>
                }
              >
                <Route path="/" element={<DomaenenKarte />} />
                <Route path="/domaenen/:domaeneId" element={<DomaenenLog />} />
                <Route path="/konto" element={<KontoSeite />} />
                <Route
                  path="/gesamt-log"
                  element={
                    <Suspense fallback={<Spinner />}>
                      <GesamtLog />
                    </Suspense>
                  }
                />
                <Route
                  path="/statistik"
                  element={
                    <Suspense fallback={<Spinner />}>
                      <Statistik />
                    </Suspense>
                  }
                />
                <Route path="/korrekturen-log" element={<KorrekturenLogSeite />} />
                <Route
                  path="/admin"
                  element={
                    <AdminNurRoute>
                      <AdminVerwaltungSeite />
                    </AdminNurRoute>
                  }
                />
              </Route>
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
