import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { LogOut, Scale, BookText, Send } from 'lucide-react';
import type { RolleTyp } from '@soziolog/shared';
import { useAuth } from '../context/AuthContext';
import { Eingabefeld, Knopf, Dialog, Schalter } from '@soziolog/ui';
import { AvatarUpload } from '../components/AvatarUpload';
import { PasswortAendernModal } from '../components/PasswortAendernModal';
import { ZweiFaktorSchalter } from '../components/ZweiFaktorSchalter';
import { apiFetch, ApiError } from '../lib/api-client';
import { ROLLEN_LABEL } from '../lib/rollen';
import { formatDatum } from '../utils/datum';

/** Icon je soziokratischer Funktionsrolle. */
const ROLLEN_ICON: Record<RolleTyp, typeof Scale> = {
  moderation: Scale,
  logbuchfuehrer: BookText,
  delegierte: Send,
};

const BERECHTIGUNG_BESCHREIBUNG: Record<string, string> = {
  Administrativ:
    'Darf Personen und Domänen verwalten und Korrekturanträge bestätigen.',
  Protokollierend:
    'Darf Bedenken, Einwände und Beschlüsse protokollieren sowie Korrekturanträge stellen.',
  Teilhabend: 'Darf alles lesen und an Vorschlägen mitwirken.',
};

const BENACHRICHTIGUNG_AUS_HINWEIS =
  'Ohne E-Mail-Benachrichtigungen erscheinen auch fällige Überprüfungen ' +
  'abgelaufener Beschlüsse NUR im System, nicht per E-Mail.';

const profilSchema = z.object({
  name: z.string().min(1, 'Der Name darf nicht leer sein.'),
  displayName: z.string().max(60, 'Höchstens 60 Zeichen.'),
  loginEmail: z.string().email('Bitte eine gültige E-Mail-Adresse angeben.'),
});
type ProfilFormular = z.infer<typeof profilSchema>;

function Abschnitt({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-rahmen bg-flaeche p-6 shadow-karte">
      <h2 className="mb-4 text-lg font-semibold text-text">{titel}</h2>
      {children}
    </section>
  );
}

export function KontoSeite() {
  const { person, neuLaden, logout } = useAuth();
  const navigate = useNavigate();
  const [profilMeldung, setProfilMeldung] = useState<string | null>(null);
  const [passwortOffen, setPasswortOffen] = useState(false);
  const [dialogOffen, setDialogOffen] = useState(false);
  const [schalterLaedt, setSchalterLaedt] = useState(false);

  const profilForm = useForm<ProfilFormular>({
    resolver: zodResolver(profilSchema),
    values: person
      ? {
          name: person.name,
          displayName: person.displayName ?? '',
          loginEmail: person.loginEmail,
        }
      : undefined,
  });

  if (!person) return null;

  // Software-Berechtigung aus Admin-Flag + Funktionsrollen ableiten.
  const berechtigung = person.istAdmin
    ? 'Administrativ'
    : person.domaenen.some((k) => k.rollen.includes('logbuchfuehrer'))
      ? 'Protokollierend'
      : 'Teilhabend';

  // Funktionsrollen zu einzelnen (Rolle, Domäne)-Zeilen ausrollen.
  const funktionsrollen = person.domaenen.flatMap((d) =>
    d.rollen.map((rolle) => ({ rolle, domaene: d.name, key: `${d.domaeneId}-${rolle}` })),
  );

  const speichereProfil = profilForm.handleSubmit(async (daten) => {
    setProfilMeldung(null);
    try {
      await apiFetch('/api/konto', { method: 'PATCH', body: JSON.stringify(daten) });
      await neuLaden();
      setProfilMeldung('Gespeichert.');
    } catch (e) {
      setProfilMeldung(e instanceof ApiError ? e.fehler.nachricht : 'Speichern fehlgeschlagen.');
    }
  });

  async function setzeBenachrichtigungen(aktiv: boolean) {
    setSchalterLaedt(true);
    try {
      await apiFetch('/api/konto', {
        method: 'PATCH',
        body: JSON.stringify({ benachrichtigungenAktiv: aktiv }),
      });
      await neuLaden();
    } finally {
      setSchalterLaedt(false);
    }
  }

  function benachrichtigungUmschalten() {
    if (person!.benachrichtigungenAktiv) setDialogOffen(true);
    else void setzeBenachrichtigungen(true);
  }

  async function abmelden() {
    await logout();
    navigate('/login');
  }

  return (
    <div>
      <h1 className="font-serif text-3xl font-bold text-text">Mein Konto</h1>
      <p className="mb-6 mt-1 text-sm text-leise">
        Persönliche Daten, Rollen und Sicherheitseinstellungen.
      </p>

      <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
        {/* LINKS: Profil + Rollen */}
        <div className="space-y-6">
          <Abschnitt titel="Profil">
            <div className="flex flex-col items-center gap-4 text-center">
              <AvatarUpload
                name={person.name}
                avatarUrl={person.avatarUrl}
                avatarColor={person.avatarColor}
                avatarTextColor={person.avatarTextColor}
                onHochgeladen={neuLaden}
              />
              <div>
                <p className="font-serif text-xl font-bold text-text">{person.name}</p>
                <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-primaer-soft px-2.5 py-0.5 text-xs font-semibold text-primaer-softtext">
                  <span className="h-1.5 w-1.5 rounded-full bg-primaer" aria-hidden="true" />
                  {berechtigung}
                </span>
                <p className="mt-2 text-sm text-leise">{person.loginEmail}</p>
                <p className="text-xs text-leise">Mitglied seit {formatDatum(person.angelegtAm)}</p>
                <p className="mt-3 text-xs text-leise">
                  Ein Profilfoto ersetzt die Initialen — dranklicken zum Hochladen.
                </p>
              </div>
            </div>
          </Abschnitt>

          <Abschnitt titel="Meine Rollen">
            <p className="-mt-2 mb-4 text-sm text-leise">
              Software-Berechtigung und soziokratische Funktionen. Änderungen erfolgen
              durch einen Admin in der Verwaltung.
            </p>

            <div className="rounded-xl border border-primaer/25 bg-primaer-soft/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-primaer-softtext">
                Software-Berechtigung
              </p>
              <p className="mt-1 font-semibold text-text">{berechtigung}</p>
              <p className="mt-1 text-sm text-leise">{BERECHTIGUNG_BESCHREIBUNG[berechtigung]}</p>
            </div>

            <p className="mb-2 mt-5 text-xs font-medium uppercase tracking-wide text-leise">
              Funktionsrollen je Domäne
            </p>
            {funktionsrollen.length === 0 ? (
              <p className="text-sm text-leise">Keine Funktionsrolle in einer Domäne.</p>
            ) : (
              <ul className="space-y-1.5">
                {funktionsrollen.map(({ rolle, domaene, key }) => {
                  const Icon = ROLLEN_ICON[rolle];
                  return (
                    <li
                      key={key}
                      className="flex items-center gap-3 rounded-lg border border-rahmen bg-flaeche-2 px-3 py-2.5"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-flaeche text-leise">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="font-medium text-text">{ROLLEN_LABEL[rolle]}</span>
                      <span className="ml-auto truncate text-sm text-leise">{domaene}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Abschnitt>
        </div>

        {/* RECHTS: Persönliche Daten + Sicherheit */}
        <div className="space-y-6">
          <Abschnitt titel="Persönliche Daten">
            <p className="-mt-2 mb-4 text-sm text-leise">
              Dein Name erscheint als „Erfasst von" im Logbuch, wenn du protokollierst.
            </p>
            <form onSubmit={speichereProfil} noValidate>
              <div className="grid gap-x-4 sm:grid-cols-2">
                <Eingabefeld
                  label="Vollständiger Name"
                  fehler={profilForm.formState.errors.name?.message}
                  {...profilForm.register('name')}
                />
                <Eingabefeld
                  label="Anzeigename"
                  helfertext="Wird in Domänen und Logs angezeigt."
                  fehler={profilForm.formState.errors.displayName?.message}
                  {...profilForm.register('displayName')}
                />
              </div>
              <Eingabefeld
                label="E-Mail-Adresse"
                type="email"
                fehler={profilForm.formState.errors.loginEmail?.message}
                {...profilForm.register('loginEmail')}
              />
              <div className="flex items-center justify-end gap-3">
                {profilMeldung && <span className="text-sm text-leise">{profilMeldung}</span>}
                <Knopf type="submit" disabled={profilForm.formState.isSubmitting}>
                  Speichern
                </Knopf>
              </div>
            </form>
          </Abschnitt>

          <Abschnitt titel="Sicherheit & Login">
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-text">Passwort</p>
                  <p className="text-xs text-leise">
                    {person.passwortGeaendertAm
                      ? `Zuletzt geändert am ${formatDatum(person.passwortGeaendertAm)}`
                      : 'Noch nie geändert.'}
                  </p>
                </div>
                <Knopf variante="sekundaer" onClick={() => setPasswortOffen(true)}>
                  Passwort ändern
                </Knopf>
              </div>

              <ZweiFaktorSchalter aktiv={person.zweiFaktorAktiv} onGeaendert={neuLaden} />

              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-text">E-Mail-Benachrichtigungen</p>
                  <p className="text-xs text-leise">
                    Bei neuen Vorschlägen und Beschlüssen in meinen Domänen
                  </p>
                </div>
                <Schalter
                  an={person.benachrichtigungenAktiv}
                  onUmschalten={benachrichtigungUmschalten}
                  disabled={schalterLaedt}
                  label="E-Mail-Benachrichtigungen"
                />
              </div>
            </div>
          </Abschnitt>

          <button
            type="button"
            onClick={abmelden}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-gefahr px-4 py-2.5 text-sm font-medium text-gefahr transition-colors hover:bg-gefahr/5"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Abmelden
          </button>
        </div>
      </div>

      <PasswortAendernModal offen={passwortOffen} onSchliessen={() => setPasswortOffen(false)} />

      {/* Bewusster Hinweis vor dem Ausschalten der Benachrichtigungen */}
      <Dialog
        offen={dialogOffen}
        titel="Benachrichtigungen ausschalten?"
        onSchliessen={() => setDialogOffen(false)}
        fussleiste={
          <div className="flex justify-end gap-2">
            <Knopf variante="ghost" onClick={() => setDialogOffen(false)}>
              Abbrechen
            </Knopf>
            <Knopf
              variante="gefahr"
              disabled={schalterLaedt}
              onClick={async () => {
                await setzeBenachrichtigungen(false);
                setDialogOffen(false);
              }}
            >
              Ausschalten
            </Knopf>
          </div>
        }
      >
        <p className="text-sm text-text">{BENACHRICHTIGUNG_AUS_HINWEIS}</p>
      </Dialog>
    </div>
  );
}
