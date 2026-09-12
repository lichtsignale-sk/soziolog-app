import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AuthKarte, Eingabefeld, Knopf } from '@soziolog/ui';
import { apiFetch, ApiError } from '../lib/api-client';

const schema = z
  .object({
    passwort: z.string().min(8, 'Das Passwort muss mindestens 8 Zeichen haben.'),
    wiederholung: z.string(),
  })
  .refine((d) => d.passwort === d.wiederholung, {
    message: 'Die Passwörter stimmen nicht überein.',
    path: ['wiederholung'],
  });
type Formular = z.infer<typeof schema>;

interface Basis {
  name: string;
  loginEmail: string;
}

export function EinladungSeite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [basis, setBasis] = useState<Basis | null>(null);
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Formular>({ resolver: zodResolver(schema) });

  useEffect(() => {
    apiFetch<Basis>(`/api/einladung/${token}`)
      .then((b) => setBasis(b))
      .catch((e) =>
        setLadeFehler(
          e instanceof ApiError ? e.fehler.nachricht : 'Einladung ungültig.',
        ),
      )
      .finally(() => setLaedt(false));
  }, [token]);

  const absenden = handleSubmit(async (daten) => {
    setFehler(null);
    try {
      await apiFetch(`/api/einladung/${token}/aktivieren`, {
        method: 'POST',
        body: JSON.stringify({ passwort: daten.passwort }),
      });
      navigate('/login');
    } catch (e) {
      setFehler(
        e instanceof ApiError ? e.fehler.nachricht : 'Aktivierung fehlgeschlagen.',
      );
    }
  });

  if (laedt) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Lädt …
      </div>
    );
  }

  if (ladeFehler) {
    return (
      <AuthKarte titel="Einladung">
        <p className="text-red-600 mb-6">{ladeFehler}</p>
        <Link to="/login" className="text-primaer hover:underline text-sm">
          Zur Anmeldung
        </Link>
      </AuthKarte>
    );
  }

  return (
    <AuthKarte titel="Konto aktivieren" untertitel={`Willkommen, ${basis?.name}`}>
      <p className="text-gray-500 text-sm mb-6">
        Setze ein Passwort für {basis?.loginEmail}.
      </p>
      <form onSubmit={absenden} noValidate>
        <Eingabefeld
          label="Passwort"
          type="password"
          autoComplete="new-password"
          fehler={errors.passwort?.message}
          {...register('passwort')}
        />
        <Eingabefeld
          label="Passwort wiederholen"
          type="password"
          autoComplete="new-password"
          fehler={errors.wiederholung?.message}
          {...register('wiederholung')}
        />
        {fehler && (
          <p className="mb-4 text-sm text-red-600" role="alert">
            {fehler}
          </p>
        )}
        <Knopf type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Aktivieren …' : 'Konto aktivieren'}
        </Knopf>
      </form>
    </AuthKarte>
  );
}
