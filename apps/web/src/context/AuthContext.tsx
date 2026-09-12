import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { AktuellePersonDTO } from '@soziolog/shared';
import { apiFetch, holeCsrf, ApiError } from '../lib/api-client';

interface AuthKontext {
  person: AktuellePersonDTO | null;
  laedt: boolean;
  /** true, solange der Erst-Setup noch nötig ist. */
  benoetigtSetup: boolean;
  /** true, wenn die Instanz als öffentliche Demo läuft (DEMO_MODE=1). */
  demoModus: boolean;
  /**
   * Erster Login-Schritt (Passwort). Ist bei der Person die E-Mail-2FA aktiv,
   * wird noch keine Sitzung ausgestellt, sondern `{ zweiFaktorErforderlich: true }`
   * zurückgegeben – der Nutzer muss dann den per Mail zugesandten Code über
   * `zweiFaktorLoginVerifizieren` bestätigen.
   */
  login: (
    nutzernameOderEmail: string,
    passwort: string,
  ) => Promise<{ zweiFaktorErforderlich: boolean }>;
  /** Zweiter Login-Schritt: den per E-Mail zugesandten 6-stelligen Code prüfen. */
  zweiFaktorLoginVerifizieren: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Lädt die eigene Person neu (z. B. nach Konto-Änderung). */
  neuLaden: () => Promise<void>;
  /** Wird nach erfolgreichem Setup aufgerufen; hebt die Setup-Weiterleitung auf. */
  setupErledigt: () => void;
}

const Kontext = createContext<AuthKontext | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [person, setPerson] = useState<AktuellePersonDTO | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [benoetigtSetup, setBenoetigtSetup] = useState(false);
  const [demoModus, setDemoModus] = useState(false);

  const ladeIch = useCallback(async () => {
    try {
      const p = await apiFetch<AktuellePersonDTO>('/api/auth/ich');
      setPerson(p);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setPerson(null);
      } else {
        throw e;
      }
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await holeCsrf();
        const status = await apiFetch<{
          benoetigtSetup: boolean;
          demoModus?: boolean;
        }>('/api/setup/status');
        setBenoetigtSetup(status.benoetigtSetup);
        setDemoModus(Boolean(status.demoModus));
        if (!status.benoetigtSetup) {
          await ladeIch();
        }
      } finally {
        setLaedt(false);
      }
    })();
  }, [ladeIch]);

  const login = useCallback(
    async (nutzernameOderEmail: string, passwort: string) => {
      const antwort = await apiFetch<
        { person: unknown } | { zweiFaktorErforderlich: true }
      >('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ nutzernameOderEmail, passwort }),
      });
      if (antwort && 'zweiFaktorErforderlich' in antwort) {
        return { zweiFaktorErforderlich: true };
      }
      await ladeIch();
      return { zweiFaktorErforderlich: false };
    },
    [ladeIch],
  );

  const zweiFaktorLoginVerifizieren = useCallback(
    async (code: string) => {
      await apiFetch('/api/auth/2fa/login-verifizieren', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      await ladeIch();
    },
    [ladeIch],
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setPerson(null);
    }
  }, []);

  const setupErledigt = useCallback(() => setBenoetigtSetup(false), []);

  return (
    <Kontext.Provider
      value={{
        person,
        laedt,
        benoetigtSetup,
        demoModus,
        login,
        zweiFaktorLoginVerifizieren,
        logout,
        neuLaden: ladeIch,
        setupErledigt,
      }}
    >
      {children}
    </Kontext.Provider>
  );
}

export function useAuth(): AuthKontext {
  const ctx = useContext(Kontext);
  if (!ctx) {
    throw new Error('useAuth muss innerhalb von <AuthProvider> genutzt werden.');
  }
  return ctx;
}
