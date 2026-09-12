import { useEffect, useState } from 'react';
import { useForm, type Path, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eingabefeld, Knopf } from '@soziolog/ui';
import { apiFetch, ApiError } from '../lib/api-client';

const personSchema = z.object({
  name: z.string().min(1, 'Name erforderlich.'),
  email: z.string().email('Gültige E-Mail erforderlich.'),
});

/** Wandelt den mehrzeiligen Freitext des Aufgaben-Feldes in eine Aufgabenliste um. */
function zeilenZuAufgaben(text: string): string[] {
  return text
    .split('\n')
    .map((zeile) => zeile.trim())
    .filter(Boolean);
}

const schema = z.object({
  smtp: z.object({
    host: z.string().min(1, 'SMTP-Host erforderlich.'),
    port: z.number().int().min(1).max(65535),
    user: z.string().optional(),
    passwort: z.string().optional(),
    absender: z.string().min(1, 'Absender erforderlich.'),
  }),
  organisationName: z.string().min(1, 'Organisationsname erforderlich.'),
  hauptdomaene: z.object({
    name: z.string().min(1, 'Name erforderlich.'),
    ziel: z.string().min(1, 'Ziel erforderlich.'),
    tasksText: z
      .string()
      .refine(
        (s) => zeilenZuAufgaben(s).length >= 1,
        'Mindestens eine Domänenaufgabe ist erforderlich.',
      )
      .refine(
        (s) => zeilenZuAufgaben(s).length <= 10,
        'Höchstens 10 Domänenaufgaben erlaubt.',
      ),
  }),
  startpersonen: z.tuple([personSchema, personSchema, personSchema]),
});
type Formular = z.infer<typeof schema>;

const ROLLEN = ['admin', 'moderation', 'teilhabender'] as const;
const ROLLEN_LABEL = ['Admin', 'Moderation', 'Teilhabender'];

/** Pflichtfelder je Schritt (per Name, damit das Weglassen eines Schritts trägt). */
const FELDER: Record<string, Path<Formular>[]> = {
  SMTP: ['smtp.host', 'smtp.port', 'smtp.absender'],
  Organisation: ['organisationName'],
  Hauptdomäne: ['hauptdomaene.name', 'hauptdomaene.ziel', 'hauptdomaene.tasksText'],
  Startpersonen: [
    'startpersonen.0.name',
    'startpersonen.0.email',
    'startpersonen.1.name',
    'startpersonen.1.email',
    'startpersonen.2.name',
    'startpersonen.2.email',
  ],
};

/**
 * Lädt den Setup-Status und entscheidet, ob der SMTP-Schritt gebraucht wird.
 * Hat der Server bereits ein SMTP-Relay per Env (SMTP_*), entfällt der Schritt –
 * die Instanz verschickt dann über dieses vom Betrieb vorgegebene Relay.
 */
export function SetupWizard() {
  const [smtpVorhanden, setSmtpVorhanden] = useState<boolean | null>(null);

  useEffect(() => {
    let aktiv = true;
    apiFetch<{ benoetigtSetup: boolean; smtpVorhanden: boolean }>('/api/setup/status')
      .then((s) => {
        if (aktiv) setSmtpVorhanden(Boolean(s?.smtpVorhanden));
      })
      .catch(() => {
        // Im Zweifel (Status nicht ladbar) den SMTP-Schritt anzeigen.
        if (aktiv) setSmtpVorhanden(false);
      });
    return () => {
      aktiv = false;
    };
  }, []);

  if (smtpVorhanden === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <p className="text-gray-500">Wird geladen …</p>
      </div>
    );
  }

  return <SetupWizardInner smtpVorhanden={smtpVorhanden} />;
}

function SetupWizardInner({ smtpVorhanden }: { smtpVorhanden: boolean }) {
  const { setupErledigt } = useAuth();
  const smtpAktiv = !smtpVorhanden;
  const SCHRITTE = smtpAktiv
    ? ['SMTP', 'Organisation', 'Hauptdomäne', 'Startpersonen', 'Zusammenfassung']
    : ['Organisation', 'Hauptdomäne', 'Startpersonen', 'Zusammenfassung'];

  const [schritt, setSchritt] = useState(0);
  const [fehler, setFehler] = useState<string | null>(null);
  const [fertig, setFertig] = useState<{ versandFehler: number } | null>(null);
  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<Formular>({
    // Ohne SMTP-Schritt wird das smtp-Feld aus der Validierung ausgenommen.
    resolver: (smtpAktiv
      ? zodResolver(schema)
      : zodResolver(schema.omit({ smtp: true }))) as Resolver<Formular>,
    defaultValues: { smtp: { port: 587 } } as Partial<Formular>,
  });

  async function weiter() {
    const ok = await trigger(FELDER[SCHRITTE[schritt]] ?? []);
    if (ok) setSchritt((s) => s + 1);
  }

  const absenden = handleSubmit(async (daten) => {
    setFehler(null);
    try {
      const antwort = await apiFetch<{ versandFehler: string[] }>('/api/setup', {
        method: 'POST',
        body: JSON.stringify({
          ...(smtpAktiv ? { smtp: daten.smtp } : {}),
          organisationName: daten.organisationName,
          hauptdomaene: {
            name: daten.hauptdomaene.name,
            ziel: daten.hauptdomaene.ziel,
            tasks: zeilenZuAufgaben(daten.hauptdomaene.tasksText),
          },
          startpersonen: daten.startpersonen.map((p, i) => ({
            name: p.name,
            email: p.email,
            rolle: ROLLEN[i],
          })),
        }),
      });
      setupErledigt();
      setFertig({ versandFehler: antwort.versandFehler.length });
    } catch (e) {
      setFehler(e instanceof ApiError ? e.fehler.nachricht : 'Setup fehlgeschlagen.');
    }
  });

  if (fertig) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-primaer mb-2">Setup abgeschlossen</h1>
          <p className="text-gray-700 mb-4">
            Organisation, Hauptdomäne und die drei Startpersonen wurden angelegt.
            Einladungs-E-Mails wurden verschickt.
          </p>
          {fertig.versandFehler > 0 && (
            <p className="text-amber-700 text-sm mb-4">
              {fertig.versandFehler} Einladung(en) konnten nicht versendet werden –
              der Versand kann später wiederholt werden.
            </p>
          )}
          <Link to="/login" className="text-primaer hover:underline">
            Zur Anmeldung
          </Link>
        </div>
      </div>
    );
  }

  const werte = getValues();
  const aktuell = SCHRITTE[schritt];

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      {/* Höchstens 800 px breit und mittig: Auf dem Desktop lief der
          Assistent über die ganze Fensterbreite, und die Zusammenfassung
          stand weit auseinandergezogen da (gemeldet am 12.09.2026). */}
      <div className="mx-auto w-full max-w-[800px]">
        <h1 className="text-2xl font-bold text-primaer mb-1">SozioLog einrichten</h1>
        <p className="text-gray-500 text-sm mb-6">
          Schritt {schritt + 1} von {SCHRITTE.length}: {aktuell}
        </p>

        <div className="bg-white rounded-xl shadow p-6">
          {aktuell === 'SMTP' && (
            <>
              <Eingabefeld label="SMTP-Host" fehler={errors.smtp?.host?.message} {...register('smtp.host')} />
              <Eingabefeld
                label="SMTP-Port"
                type="number"
                fehler={errors.smtp?.port?.message}
                {...register('smtp.port', { valueAsNumber: true })}
              />
              <Eingabefeld label="SMTP-Benutzer (optional)" {...register('smtp.user')} />
              <Eingabefeld label="SMTP-Passwort (optional)" type="password" {...register('smtp.passwort')} />
              <Eingabefeld label="Absender-Adresse" fehler={errors.smtp?.absender?.message} {...register('smtp.absender')} />
            </>
          )}

          {aktuell === 'Organisation' && (
            <Eingabefeld
              label="Organisationsname"
              fehler={errors.organisationName?.message}
              {...register('organisationName')}
            />
          )}

          {aktuell === 'Hauptdomäne' && (
            <>
              <Eingabefeld label="Name der Hauptdomäne" fehler={errors.hauptdomaene?.name?.message} {...register('hauptdomaene.name')} />
              <Eingabefeld label="Ziel" fehler={errors.hauptdomaene?.ziel?.message} {...register('hauptdomaene.ziel')} />
              <div className="mb-4">
                <label htmlFor="hauptdomaene-tasks" className="mb-1 block text-sm font-medium text-gray-700">
                  Domänenaufgaben (eine pro Zeile)
                </label>
                <textarea
                  id="hauptdomaene-tasks"
                  rows={4}
                  className="w-full rounded-lg border border-rahmen px-3 py-2 focus:border-primaer focus:outline-none"
                  {...register('hauptdomaene.tasksText')}
                />
                {errors.hauptdomaene?.tasksText && (
                  <p className="mt-1 text-sm text-red-600" role="alert">
                    {errors.hauptdomaene.tasksText.message}
                  </p>
                )}
              </div>
            </>
          )}

          {aktuell === 'Startpersonen' && (
            <div className="space-y-5">
              {([0, 1, 2] as const).map((i) => (
                <div key={i} className="border-b border-gray-100 pb-4 last:border-0">
                  <p className="text-sm font-semibold text-gray-700 mb-2">{ROLLEN_LABEL[i]}</p>
                  <Eingabefeld
                    label="Name"
                    fehler={errors.startpersonen?.[i]?.name?.message}
                    {...register(`startpersonen.${i}.name` as const)}
                  />
                  <Eingabefeld
                    label="E-Mail"
                    type="email"
                    fehler={errors.startpersonen?.[i]?.email?.message}
                    {...register(`startpersonen.${i}.email` as const)}
                  />
                </div>
              ))}
            </div>
          )}

          {aktuell === 'Zusammenfassung' && (
            <div className="text-sm text-gray-700 space-y-2">
              <p><span className="font-medium">Organisation:</span> {werte.organisationName}</p>
              <p><span className="font-medium">Hauptdomäne:</span> {werte.hauptdomaene?.name} — {zeilenZuAufgaben(werte.hauptdomaene?.tasksText ?? '').join(', ')}</p>
              <p>
                <span className="font-medium">SMTP:</span>{' '}
                {smtpAktiv
                  ? `${werte.smtp?.host}:${werte.smtp?.port}`
                  : 'über den Server konfiguriert'}
              </p>
              <div>
                <span className="font-medium">Startpersonen:</span>
                <ul className="list-disc ml-5 mt-1">
                  {[0, 1, 2].map((i) => (
                    <li key={i}>
                      {ROLLEN_LABEL[i]}: {werte.startpersonen?.[i]?.name} ({werte.startpersonen?.[i]?.email})
                    </li>
                  ))}
                </ul>
              </div>
              {fehler && <p className="text-red-600" role="alert">{fehler}</p>}
            </div>
          )}
        </div>

        <div className="flex justify-between mt-6">
          <Knopf
            variante="sekundaer"
            onClick={() => setSchritt((s) => Math.max(0, s - 1))}
            disabled={schritt === 0 || isSubmitting}
          >
            Zurück
          </Knopf>
          {schritt < SCHRITTE.length - 1 ? (
            <Knopf onClick={weiter}>Weiter</Knopf>
          ) : (
            <Knopf onClick={absenden} disabled={isSubmitting}>
              {isSubmitting ? 'Wird eingerichtet …' : 'Einrichten & einladen'}
            </Knopf>
          )}
        </div>
      </div>
    </div>
  );
}
