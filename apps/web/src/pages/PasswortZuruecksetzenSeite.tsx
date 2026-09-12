import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthKarte, Eingabefeld, Knopf } from '@soziolog/ui';
import { apiFetch, ApiError } from '../lib/api-client';

const schema = z
  .object({
    neuesPasswort: z
      .string()
      .min(8, 'Das neue Passwort muss mindestens 8 Zeichen haben.'),
    wiederholung: z.string(),
  })
  .refine((d) => d.neuesPasswort === d.wiederholung, {
    message: 'Die Passwörter stimmen nicht überein.',
    path: ['wiederholung'],
  });
type Formular = z.infer<typeof schema>;

export function PasswortZuruecksetzenSeite() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const [fehler, setFehler] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Formular>({ resolver: zodResolver(schema) });

  const absenden = handleSubmit(async (daten) => {
    setFehler(null);
    try {
      await apiFetch('/api/auth/passwort-zuruecksetzen', {
        method: 'POST',
        body: JSON.stringify({ token, neuesPasswort: daten.neuesPasswort }),
      });
      navigate('/login');
    } catch (e) {
      setFehler(
        e instanceof ApiError
          ? e.fehler.nachricht
          : 'Zurücksetzen fehlgeschlagen.',
      );
    }
  });

  if (!token) {
    return (
      <AuthKarte titel="Passwort zurücksetzen">
        <p className="text-red-600 mb-6">
          Der Link ist unvollständig oder ungültig.
        </p>
        <Link to="/passwort-vergessen" className="text-primaer hover:underline text-sm">
          Neuen Link anfordern
        </Link>
      </AuthKarte>
    );
  }

  return (
    <AuthKarte titel="Passwort zurücksetzen" untertitel="Wähle ein neues Passwort">
      <form onSubmit={absenden} noValidate>
        <Eingabefeld
          label="Neues Passwort"
          type="password"
          autoComplete="new-password"
          fehler={errors.neuesPasswort?.message}
          {...register('neuesPasswort')}
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
          {isSubmitting ? 'Speichern …' : 'Passwort setzen'}
        </Knopf>
      </form>
    </AuthKarte>
  );
}
