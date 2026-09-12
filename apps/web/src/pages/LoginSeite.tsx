import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthKarte, Eingabefeld, Knopf } from '@soziolog/ui';
import { apiFetch, ApiError } from '../lib/api-client';

/** Sekunden bis zum nächsten möglichen „Code erneut senden". */
const ERNEUT_SENDEN_SEKUNDEN = 60;

const schema = z.object({
  nutzernameOderEmail: z.string().min(1, 'Bitte Nutzername oder E-Mail angeben.'),
  passwort: z.string().min(1, 'Bitte Passwort angeben.'),
});
type Formular = z.infer<typeof schema>;

export function LoginSeite() {
  const { login, zweiFaktorLoginVerifizieren } = useAuth();
  const navigate = useNavigate();
  const [fehler, setFehler] = useState<string | null>(null);
  // Nach korrektem Passwort mit aktiver E-Mail-2FA: Schritt 2 (Code eingeben).
  const [codeSchritt, setCodeSchritt] = useState(false);
  const [code, setCode] = useState('');
  const [codeLaedt, setCodeLaedt] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [restSekunden, setRestSekunden] = useState(0);
  const [erneutLaedt, setErneutLaedt] = useState(false);

  // Countdown für „Code erneut senden".
  useEffect(() => {
    if (restSekunden <= 0) return;
    const id = setTimeout(() => setRestSekunden((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [restSekunden]);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Formular>({ resolver: zodResolver(schema) });

  const absenden = handleSubmit(async (daten) => {
    setFehler(null);
    try {
      const { zweiFaktorErforderlich } = await login(
        daten.nutzernameOderEmail,
        daten.passwort,
      );
      if (zweiFaktorErforderlich) {
        setCodeSchritt(true);
        setRestSekunden(ERNEUT_SENDEN_SEKUNDEN);
        return;
      }
      navigate('/');
    } catch (e) {
      setFehler(
        e instanceof ApiError ? e.fehler.nachricht : 'Anmeldung fehlgeschlagen.',
      );
    }
  });

  async function codeAbsenden(ev: React.FormEvent) {
    ev.preventDefault();
    setFehler(null);
    setInfo(null);
    setCodeLaedt(true);
    try {
      await zweiFaktorLoginVerifizieren(code.trim());
      navigate('/');
    } catch (e) {
      setFehler(
        e instanceof ApiError
          ? e.fehler.nachricht
          : 'Der Code konnte nicht bestätigt werden.',
      );
    } finally {
      setCodeLaedt(false);
    }
  }

  async function codeErneutSenden() {
    setFehler(null);
    setInfo(null);
    setErneutLaedt(true);
    try {
      await apiFetch('/api/auth/2fa/code-erneut-senden', { method: 'POST' });
      setInfo('Wir haben dir einen neuen Code geschickt.');
      setCode('');
      setRestSekunden(ERNEUT_SENDEN_SEKUNDEN);
    } catch (e) {
      setFehler(
        e instanceof ApiError
          ? e.fehler.nachricht
          : 'Es konnte kein neuer Code gesendet werden.',
      );
    } finally {
      setErneutLaedt(false);
    }
  }

  if (codeSchritt) {
    return (
      <AuthKarte titel="SozioLog" untertitel="Bestätigung">
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-rahmen bg-flaeche-2 p-3">
          <MailCheck
            className="mt-0.5 h-5 w-5 shrink-0 text-primaer"
            aria-hidden="true"
          />
          <p className="text-sm text-leise">
            Wir haben dir einen 6-stelligen Bestätigungscode per E-Mail
            geschickt. Bitte gib ihn hier ein, um die Anmeldung abzuschließen.
            Der Code ist 10 Minuten gültig.
          </p>
        </div>
        {info && (
          <p className="mb-4 text-sm text-primaer-softtext" role="status">
            {info}
          </p>
        )}
        <form onSubmit={codeAbsenden} noValidate>
          <Eingabefeld
            id="code"
            label="Bestätigungscode"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          {fehler && (
            <p className="mb-4 text-sm text-red-600" role="alert">
              {fehler}
            </p>
          )}
          <Knopf
            type="submit"
            className="w-full"
            disabled={codeLaedt || code.trim().length !== 6}
          >
            {codeLaedt ? 'Bestätigen …' : 'Bestätigen'}
          </Knopf>
        </form>
        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          <button
            type="button"
            className="text-primaer hover:underline"
            onClick={() => {
              setCodeSchritt(false);
              setCode('');
              setFehler(null);
              setInfo(null);
            }}
          >
            Zurück zur Anmeldung
          </button>
          <button
            type="button"
            disabled={restSekunden > 0 || erneutLaedt}
            onClick={codeErneutSenden}
            className="text-primaer hover:underline disabled:text-leise disabled:no-underline"
          >
            {restSekunden > 0
              ? `Neuen Code in ${restSekunden}s`
              : erneutLaedt
                ? 'Wird gesendet …'
                : 'Neuen Code anfordern'}
          </button>
        </div>
      </AuthKarte>
    );
  }

  return (
    <AuthKarte titel="SozioLog" untertitel="Anmelden">
      <form onSubmit={absenden} noValidate>
        <Eingabefeld
          label="Nutzername oder E-Mail"
          autoComplete="username"
          fehler={errors.nutzernameOderEmail?.message}
          {...register('nutzernameOderEmail')}
        />
        <Eingabefeld
          label="Passwort"
          type="password"
          autoComplete="current-password"
          fehler={errors.passwort?.message}
          {...register('passwort')}
        />
        {fehler && (
          <p className="mb-4 text-sm text-red-600" role="alert">
            {fehler}
          </p>
        )}
        <Knopf type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Anmelden …' : 'Anmelden'}
        </Knopf>
      </form>
      <div className="mt-4 text-sm">
        <Link to="/passwort-vergessen" className="text-primaer hover:underline">
          Passwort vergessen?
        </Link>
      </div>
    </AuthKarte>
  );
}
