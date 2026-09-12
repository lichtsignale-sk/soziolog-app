import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserPlus, Mail, SlidersHorizontal, Ban, RotateCcw } from 'lucide-react';
import type { AdminPersonDTO, PersonStatus } from '@soziolog/shared';
import { apiFetch, ApiError } from '../../lib/api-client';
import { initialen, avatarStil } from '../../lib/avatar';
import {
  Tabelle,
  Knopf,
  Dialog,
  Eingabefeld,
  LeerZustand,
  Spinner,
  useToast,
} from '@soziolog/ui';
import { RollenVerwaltenModal } from '../../components/RollenVerwaltenModal';

const anlegenSchema = z.object({
  name: z.string().min(1, 'Der Name darf nicht leer sein.'),
  nutzername: z.string().min(3, 'Mindestens 3 Zeichen.'),
  loginEmail: z.string().email('Bitte eine gültige E-Mail-Adresse angeben.'),
  istAdmin: z.boolean(),
});
type AnlegenFormular = z.infer<typeof anlegenSchema>;

/** Folgenreiche Aktion, die vor Ausführung bestätigt werden muss. */
interface Bestaetigung {
  personId: string;
  name: string;
  aktion: 'deaktivieren' | 'reaktivieren';
}

const BESTAETIGUNG_TEXT: Record<
  Bestaetigung['aktion'],
  { titel: string; text: string; knopf: string; gefahr: boolean }
> = {
  deaktivieren: {
    titel: 'Person deaktivieren?',
    text: 'Die Person verliert sofort den Zugang zu SozioLog. Bereits erfasste Einträge bleiben erhalten.',
    knopf: 'Bestätigen',
    gefahr: true,
  },
  reaktivieren: {
    titel: 'Person reaktivieren?',
    text: 'Die Person erhält wieder Zugang zu SozioLog mit ihren bisherigen Rollen.',
    knopf: 'Reaktivieren',
    gefahr: false,
  },
};

type StatusFilter = 'alle' | PersonStatus;

const STATUS_PUNKT: Record<PersonStatus, { label: string; punkt: string }> = {
  aktiv: { label: 'Aktiv', punkt: 'bg-beschluss-rahmen' },
  deaktiviert: { label: 'Deaktiviert', punkt: 'bg-leise' },
  eingeladen: { label: 'Eingeladen', punkt: 'bg-bedenken-rahmen' },
};

// Sortierreihenfolge: Aktive oben, Eingeladene/Deaktivierte immer ganz nach unten.
const STATUS_REIHENFOLGE: Record<PersonStatus, number> = {
  aktiv: 0,
  eingeladen: 1,
  deaktiviert: 2,
};

const BERECHTIGUNG_KLASSE: Record<string, string> = {
  Administrativ: 'bg-beschluss-bg text-beschluss-text',
  Protokollierend: 'bg-vorschlag-bg text-vorschlag-text',
  Teilhabend: 'bg-flaeche-3 text-leise',
};

const FILTER_TABS: { schluessel: StatusFilter; label: string }[] = [
  { schluessel: 'alle', label: 'Alle' },
  { schluessel: 'aktiv', label: 'Aktiv' },
  { schluessel: 'deaktiviert', label: 'Deaktiviert' },
  { schluessel: 'eingeladen', label: 'Eingeladen' },
];

export function PersonenBereich() {
  const toast = useToast();
  const [personen, setPersonen] = useState<AdminPersonDTO[] | null>(null);
  const [anlegenOffen, setAnlegenOffen] = useState(false);
  const [bestaetigung, setBestaetigung] = useState<Bestaetigung | null>(null);
  const [aktivId, setAktivId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('alle');
  const [rollenPersonId, setRollenPersonId] = useState<string | null>(null);

  const form = useForm<AnlegenFormular>({
    resolver: zodResolver(anlegenSchema),
    defaultValues: { name: '', nutzername: '', loginEmail: '', istAdmin: false },
  });

  function laden() {
    apiFetch<AdminPersonDTO[]>('/api/admin/personen')
      .then(setPersonen)
      .catch(() => setPersonen([]));
  }

  useEffect(laden, []);

  const anlegen = form.handleSubmit(async (daten) => {
    try {
      const res = await apiFetch<{ mailVersendet: boolean }>('/api/admin/personen', {
        method: 'POST',
        body: JSON.stringify(daten),
      });
      toast.zeige(
        res.mailVersendet
          ? 'Person angelegt, Einladung per E-Mail versendet.'
          : 'Person angelegt, Einladungs-Mail konnte nicht versendet werden.',
        res.mailVersendet ? 'erfolg' : 'fehler',
      );
      setAnlegenOffen(false);
      form.reset();
      laden();
    } catch (e) {
      toast.zeige(e instanceof ApiError ? e.fehler.nachricht : 'Anlegen fehlgeschlagen.', 'fehler');
    }
  });

  async function einladungErneutSenden(id: string) {
    setAktivId(id);
    try {
      const res = await apiFetch<{ mailVersendet: boolean }>(
        `/api/admin/personen/${id}/einladung-erneut-senden`,
        { method: 'POST' },
      );
      toast.zeige(
        res.mailVersendet ? 'Einladung erneut versendet.' : 'Mail konnte nicht versendet werden.',
        res.mailVersendet ? 'erfolg' : 'fehler',
      );
    } catch (e) {
      toast.zeige(e instanceof ApiError ? e.fehler.nachricht : 'Senden fehlgeschlagen.', 'fehler');
    } finally {
      setAktivId(null);
    }
  }

  async function aktualisieren(id: string, daten: { aktiv?: boolean }) {
    setAktivId(id);
    try {
      await apiFetch(`/api/admin/personen/${id}`, { method: 'PATCH', body: JSON.stringify(daten) });
      toast.zeige('Gespeichert.');
      setBestaetigung(null);
      laden();
    } catch (e) {
      toast.zeige(e instanceof ApiError ? e.fehler.nachricht : 'Speichern fehlgeschlagen.', 'fehler');
    } finally {
      setAktivId(null);
    }
  }

  function bestaetigungAusfuehren() {
    if (!bestaetigung) return;
    void aktualisieren(bestaetigung.personId, {
      aktiv: bestaetigung.aktion === 'reaktivieren',
    });
  }

  const anzahlProStatus = (f: StatusFilter) =>
    f === 'alle'
      ? (personen?.length ?? 0)
      : (personen?.filter((p) => p.status === f).length ?? 0);
  const gefiltert = (personen ?? [])
    .filter((p) => statusFilter === 'alle' || p.status === statusFilter)
    .sort(
      (a, b) =>
        STATUS_REIHENFOLGE[a.status] - STATUS_REIHENFOLGE[b.status] ||
        a.name.localeCompare(b.name, 'de'),
    );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-leise">
          Personen einladen, Rollen zuweisen, Zugang aktivieren oder deaktivieren.
        </p>
        <Knopf onClick={() => setAnlegenOffen(true)}>
          <UserPlus className="h-4 w-4" aria-hidden="true" /> Person einladen
        </Knopf>
      </div>

      {/* Statusfilter mit Zählern */}
      <div className="mb-4 inline-flex gap-1 rounded-lg border border-rahmen bg-flaeche-3 p-1">
        {FILTER_TABS.map((t) => {
          const aktiv = statusFilter === t.schluessel;
          return (
            <button
              key={t.schluessel}
              type="button"
              onClick={() => setStatusFilter(t.schluessel)}
              className={`rounded-md px-3 py-1 text-sm font-semibold transition-colors ${
                aktiv ? 'bg-flaeche text-text shadow-karte' : 'text-leise hover:text-text'
              }`}
            >
              {t.label}{' '}
              <span className="ziffern-tabellarisch text-leise">· {anzahlProStatus(t.schluessel)}</span>
            </button>
          );
        })}
      </div>

      {personen === null ? (
        <Spinner />
      ) : gefiltert.length === 0 ? (
        <LeerZustand Icon={UserPlus} titel="Keine Personen in dieser Ansicht" />
      ) : (
        <>
          <Tabelle spalten={['Person', 'Berechtigung', 'Status', 'Aktionen']} beschriftung="Personen der Organisation">
            {gefiltert.map((p) => {
              const stil = avatarStil(p.name, p.avatarColor, p.avatarTextColor);
              return (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-semibold ${stil.className}`}
                        style={stil.style}
                        aria-hidden="true"
                      >
                        {initialen(p.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-medium text-text">{p.name}</p>
                        <p className="truncate text-[13px] text-leise">{p.loginEmail}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {p.berechtigung ? (
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${
                          BERECHTIGUNG_KLASSE[p.berechtigung] ?? 'bg-flaeche-3 text-leise'
                        }`}
                      >
                        {p.berechtigung}
                      </span>
                    ) : (
                      <span className="text-sm text-leise">— noch keine</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2 text-sm text-text">
                      <span
                        aria-hidden="true"
                        className={`h-2.5 w-2.5 rounded-full ${STATUS_PUNKT[p.status].punkt}`}
                      />
                      {STATUS_PUNKT[p.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {p.status === 'eingeladen' ? (
                        <Knopf
                          variante="sekundaer"
                          laedt={aktivId === p.id}
                          onClick={() => einladungErneutSenden(p.id)}
                        >
                          <Mail className="h-4 w-4" aria-hidden="true" /> Erneut einladen
                        </Knopf>
                      ) : (
                        <>
                          <Knopf variante="sekundaer" onClick={() => setRollenPersonId(p.id)}>
                            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Rollen
                          </Knopf>
                          {p.aktiv ? (
                            <button
                              type="button"
                              title="Deaktivieren"
                              aria-label={`${p.name} deaktivieren`}
                              onClick={() =>
                                setBestaetigung({ personId: p.id, name: p.name, aktion: 'deaktivieren' })
                              }
                              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-rahmen text-leise transition-colors hover:bg-flaeche-3 hover:text-text"
                            >
                              <Ban className="h-4 w-4" aria-hidden="true" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              title="Reaktivieren"
                              aria-label={`${p.name} reaktivieren`}
                              onClick={() =>
                                setBestaetigung({ personId: p.id, name: p.name, aktion: 'reaktivieren' })
                              }
                              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-primaer/40 bg-primaer-soft text-primaer-softtext transition-colors hover:bg-primaer/15"
                            >
                              <RotateCcw className="h-4 w-4" aria-hidden="true" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </Tabelle>

          {/* Fußnoten mit farbigem Statuspunkt */}
          <div className="mt-4 space-y-1.5 text-sm text-leise">
            <p className="flex items-start gap-2">
              <span
                aria-hidden="true"
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-bedenken-rahmen"
              />
              <span>
                Eingeladene Personen haben die E-Mail-Einladung noch nicht bestätigt und noch
                keine Berechtigung.
              </span>
            </p>
            <p className="flex items-start gap-2">
              <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-leise" />
              <span>
                Deaktivierte Personen bleiben im Log erhalten, können sich aber nicht mehr
                anmelden.
              </span>
            </p>
          </div>
        </>
      )}

      {/* Dialog: Person einladen */}
      <Dialog
        offen={anlegenOffen}
        eyebrow="Person einladen"
        titel="Neue Person"
        onSchliessen={() => setAnlegenOffen(false)}
        fussleiste={
          <div className="flex justify-end gap-2">
            <Knopf variante="ghost" onClick={() => setAnlegenOffen(false)}>
              Abbrechen
            </Knopf>
            <Knopf laedt={form.formState.isSubmitting} onClick={anlegen}>
              Anlegen & einladen
            </Knopf>
          </div>
        }
      >
        <form onSubmit={anlegen} noValidate className="space-y-1">
          <Eingabefeld label="Name" fehler={form.formState.errors.name?.message} {...form.register('name')} />
          <Eingabefeld
            label="Nutzername"
            fehler={form.formState.errors.nutzername?.message}
            {...form.register('nutzername')}
          />
          <Eingabefeld
            label="E-Mail"
            type="email"
            fehler={form.formState.errors.loginEmail?.message}
            {...form.register('loginEmail')}
          />
          <label className="mt-2 flex items-center gap-2 text-sm text-text">
            <input type="checkbox" className="h-4 w-4" {...form.register('istAdmin')} />
            Als Admin einladen
          </label>
        </form>
      </Dialog>

      {/* Bestätigungsdialog: Deaktivieren / Reaktivieren (M4) */}
      <Dialog
        offen={bestaetigung !== null}
        titel={bestaetigung ? BESTAETIGUNG_TEXT[bestaetigung.aktion].titel : ''}
        onSchliessen={() => setBestaetigung(null)}
        fussleiste={
          bestaetigung ? (
            <div className="flex justify-end gap-2">
              <Knopf variante="ghost" onClick={() => setBestaetigung(null)}>
                Abbrechen
              </Knopf>
              <Knopf
                variante={BESTAETIGUNG_TEXT[bestaetigung.aktion].gefahr ? 'gefahr' : 'primaer'}
                laedt={aktivId === bestaetigung.personId}
                onClick={bestaetigungAusfuehren}
              >
                {BESTAETIGUNG_TEXT[bestaetigung.aktion].knopf}
              </Knopf>
            </div>
          ) : undefined
        }
      >
        {bestaetigung && (
          <p className="text-sm text-text">
            <span className="font-medium">{bestaetigung.name}</span>:{' '}
            {BESTAETIGUNG_TEXT[bestaetigung.aktion].text}
          </p>
        )}
      </Dialog>

      {/* Rollen & Admin-Berechtigung je Person */}
      {(() => {
        const p = (personen ?? []).find((x) => x.id === rollenPersonId);
        if (!p) return null;
        return (
          <RollenVerwaltenModal
            person={p}
            offen={rollenPersonId !== null}
            onSchliessen={() => setRollenPersonId(null)}
            onGeaendert={laden}
          />
        );
      })()}
    </div>
  );
}
