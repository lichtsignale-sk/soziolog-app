import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { AuthKarte, Eingabefeld, Knopf } from '@soziolog/ui';
import { apiFetch } from '../lib/api-client';

const schema = z.object({
  email: z.string().email('Bitte eine gültige E-Mail-Adresse angeben.'),
});
type Formular = z.infer<typeof schema>;

export function PasswortVergessenSeite() {
  const [gesendet, setGesendet] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Formular>({ resolver: zodResolver(schema) });

  const absenden = handleSubmit(async (daten) => {
    // Antwort ist immer neutral; UI zeigt in jedem Fall dieselbe Bestätigung.
    try {
      await apiFetch('/api/auth/passwort-vergessen', {
        method: 'POST',
        body: JSON.stringify({ email: daten.email }),
      });
    } finally {
      setGesendet(true);
    }
  });

  return (
    <AuthKarte titel="Passwort vergessen" untertitel="Wir senden dir einen Link">
      {gesendet ? (
        <div>
          <p className="text-gray-700 mb-6">
            Falls die Adresse existiert, wurde eine E-Mail mit weiteren Schritten
            verschickt.
          </p>
          <Link to="/login" className="text-primaer hover:underline text-sm">
            Zurück zur Anmeldung
          </Link>
        </div>
      ) : (
        <form onSubmit={absenden} noValidate>
          <Eingabefeld
            label="E-Mail-Adresse"
            type="email"
            autoComplete="email"
            fehler={errors.email?.message}
            {...register('email')}
          />
          <Knopf type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Senden …' : 'Link anfordern'}
          </Knopf>
          <div className="mt-4 text-sm">
            <Link to="/login" className="text-primaer hover:underline">
              Zurück zur Anmeldung
            </Link>
          </div>
        </form>
      )}
    </AuthKarte>
  );
}
