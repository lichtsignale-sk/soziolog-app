import { useEffect, useState } from 'react';
import { X, Plus, Ban } from 'lucide-react';
import type { AdminPersonDTO, DomaeneKnotenDTO, RolleTyp } from '@soziolog/shared';
import { apiFetch, ApiError } from '../lib/api-client';
import { ROLLEN_LABEL } from '../lib/rollen';
import { DOMAENE_TYP_LABEL } from '../lib/labels';
import { initialen, avatarStil } from '../lib/avatar';
import { Dialog, Knopf, Auswahl, Schalter, useToast } from '@soziolog/ui';

type RolleWahl = RolleTyp | 'teilhabend';

/** Rollen-Auswahl je Domäne inkl. Basis „Teilhabend" (keine Funktionsrolle). */
const ROLLEN_WAHL: RolleWahl[] = ['teilhabend', 'delegierte', 'moderation', 'logbuchfuehrer'];
const rolleLabel = (r: RolleWahl) => (r === 'teilhabend' ? 'Teilhabend' : ROLLEN_LABEL[r]);

/** Eine Domäne im Entwurf: Zuordnung + gewählte Funktionsrolle. */
interface EntwurfDomaene {
  domaeneId: string;
  name: string;
  rolle: RolleWahl;
}

const BERECHTIGUNG_PILL: Record<string, string> = {
  Administrativ: 'bg-beschluss-bg text-beschluss-text',
  Protokollierend: 'bg-vorschlag-bg text-vorschlag-text',
  Teilhabend: 'bg-flaeche-3 text-leise',
};

/** Leitet die (angezeigte) Software-Berechtigung aus dem Entwurf ab. */
function berechtigungAus(istAdmin: boolean, domaenen: EntwurfDomaene[]): string {
  if (istAdmin) return 'Administrativ';
  return domaenen.some((d) => d.rolle === 'logbuchfuehrer') ? 'Protokollierend' : 'Teilhabend';
}

/**
 * Vereinte Rollen-Verwaltung je Person: organisationsweite Admin-Berechtigung
 * plus genau EINE Funktionsrolle je Domäne (teilhabend = ohne Funktionsrolle).
 * Alle Änderungen werden als Entwurf gesammelt und erst mit „Speichern" auf die
 * Admin-Endpunkte angewendet; „Abbrechen" verwirft sie.
 */
export function RollenVerwaltenModal({
  person,
  offen,
  onSchliessen,
  onGeaendert,
}: {
  person: AdminPersonDTO;
  offen: boolean;
  onSchliessen: () => void;
  onGeaendert: () => Promise<void> | void;
}) {
  const toast = useToast();
  const [alleDomaenen, setAlleDomaenen] = useState<DomaeneKnotenDTO[]>([]);
  const [speichert, setSpeichert] = useState(false);
  const [domaeneWaehlen, setDomaeneWaehlen] = useState(false);

  // Entwurfszustand (lokal, bis „Speichern").
  const [istAdmin, setIstAdmin] = useState(person.istAdmin);
  const [kontoAktiv, setKontoAktiv] = useState(person.aktiv);
  const [entwurf, setEntwurf] = useState<EntwurfDomaene[]>([]);

  // Entwurf beim Öffnen (und bei Ist-Aktualisierung) aus der Person aufbauen.
  useEffect(() => {
    if (!offen) return;
    setIstAdmin(person.istAdmin);
    setKontoAktiv(person.aktiv);
    setEntwurf(
      person.domaenen.map((k) => ({
        domaeneId: k.domaeneId,
        name: k.name,
        rolle: (k.rollen[0] ?? 'teilhabend') as RolleWahl,
      })),
    );
    setDomaeneWaehlen(false);
  }, [offen, person]);

  useEffect(() => {
    if (!offen) return;
    apiFetch<DomaeneKnotenDTO[]>('/api/domaenen')
      .then((d) => setAlleDomaenen(d.filter((k) => !k.archiviert)))
      .catch(() => setAlleDomaenen([]));
  }, [offen]);

  function rolleSetzen(domaeneId: string, rolle: RolleWahl) {
    setEntwurf((e) => e.map((d) => (d.domaeneId === domaeneId ? { ...d, rolle } : d)));
  }
  function domaeneHinzufuegen(id: string) {
    const dom = alleDomaenen.find((k) => k.id === id);
    if (!dom) return;
    setEntwurf((e) => [...e, { domaeneId: dom.id, name: dom.name, rolle: 'teilhabend' }]);
    setDomaeneWaehlen(false);
  }
  function domaeneEntfernen(domaeneId: string) {
    setEntwurf((e) => e.filter((d) => d.domaeneId !== domaeneId));
  }

  /** Wendet alle Entwurfsänderungen der Reihe nach an. */
  async function speichern() {
    setSpeichert(true);
    try {
      const originalRolle = new Map(
        person.domaenen.map((k) => [k.domaeneId, (k.rollen[0] ?? 'teilhabend') as RolleWahl]),
      );
      const entwurfIds = new Set(entwurf.map((d) => d.domaeneId));

      // 1. Neue Zuordnungen + Rollenänderungen bestehender Domänen.
      for (const d of entwurf) {
        if (!originalRolle.has(d.domaeneId)) {
          await apiFetch(`/api/admin/domaenen/${d.domaeneId}/mitglieder`, {
            method: 'POST',
            body: JSON.stringify({ personId: person.id }),
          });
          if (d.rolle !== 'teilhabend') {
            await apiFetch(`/api/admin/domaenen/${d.domaeneId}/rollen`, {
              method: 'POST',
              body: JSON.stringify({ personId: person.id, rolleTyp: d.rolle }),
            });
          }
        } else if (d.rolle !== originalRolle.get(d.domaeneId)) {
          await (d.rolle === 'teilhabend'
            ? apiFetch(`/api/admin/domaenen/${d.domaeneId}/personen/${person.id}/rolle`, {
                method: 'DELETE',
              })
            : apiFetch(`/api/admin/domaenen/${d.domaeneId}/rollen`, {
                method: 'POST',
                body: JSON.stringify({ personId: person.id, rolleTyp: d.rolle }),
              }));
        }
      }
      // 2. Entfernte Domänen.
      for (const k of person.domaenen) {
        if (!entwurfIds.has(k.domaeneId)) {
          await apiFetch(`/api/admin/domaenen/${k.domaeneId}/mitglieder/${person.id}`, {
            method: 'DELETE',
          });
        }
      }
      // 3. Admin-Berechtigung. 4. Kontozugang.
      if (istAdmin !== person.istAdmin) {
        await apiFetch(`/api/admin/personen/${person.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ istAdmin }),
        });
      }
      if (kontoAktiv !== person.aktiv) {
        await apiFetch(`/api/admin/personen/${person.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ aktiv: kontoAktiv }),
        });
      }

      await onGeaendert();
      toast.zeige('Rollen & Berechtigung gespeichert.');
      onSchliessen();
    } catch (e) {
      toast.zeige(e instanceof ApiError ? e.fehler.nachricht : 'Speichern fehlgeschlagen.', 'fehler');
      // Ist-Zustand nachladen; der Effekt gleicht den Entwurf wieder an.
      await onGeaendert();
    } finally {
      setSpeichert(false);
    }
  }

  const verfuegbar = alleDomaenen.filter((k) => !entwurf.some((d) => d.domaeneId === k.id));
  const berechtigung = berechtigungAus(istAdmin, entwurf);
  const stil = avatarStil(person.name, person.avatarColor, person.avatarTextColor);

  return (
    <Dialog
      offen={offen}
      titel={person.name}
      onSchliessen={onSchliessen}
      groesse="lg"
      kopf={
        <div className="flex items-center gap-3">
          <div
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-semibold ${stil.className}`}
            style={stil.style}
            aria-hidden="true"
          >
            {initialen(person.name)}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-leise">
              Rollen &amp; Berechtigung
            </p>
            <h2 className="truncate font-serif text-2xl font-bold text-text">{person.name}</h2>
          </div>
        </div>
      }
      fussleiste={
        <div className="flex justify-end gap-2">
          <Knopf variante="sekundaer" onClick={onSchliessen} disabled={speichert}>
            Abbrechen
          </Knopf>
          <Knopf onClick={speichern} laedt={speichert} disabled={entwurf.length === 0}>
            Speichern
          </Knopf>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Software-Berechtigung (abgeleitet) + Admin-Umschalter */}
        <div className="rounded-xl border border-primaer/20 bg-primaer-soft/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-primaer-softtext">
              Software-Berechtigung
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text">Administrativ</span>
              <Schalter
                an={istAdmin}
                onUmschalten={setIstAdmin}
                disabled={speichert}
                label="Administrativ"
              />
            </div>
          </div>
          <span
            className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-medium ${
              BERECHTIGUNG_PILL[berechtigung] ?? 'bg-flaeche-3 text-leise'
            }`}
          >
            {berechtigung}
          </span>
          <p className="mt-2 text-sm text-leise">
            Jede Person hat genau <span className="font-medium text-text">eine</span>{' '}
            Software-Berechtigung. Sie ergibt sich automatisch aus den Rollen unten: wer irgendwo{' '}
            <span className="font-medium text-text">Logbuchführend</span> ist, erhält{' '}
            <span className="font-medium text-text">Protokollierend</span> — und das nur für die
            jeweilige Domäne. <span className="font-medium text-text">Administrativ</span> wird
            gesondert vergeben und gilt organisationsweit.
          </p>
        </div>

        {/* Funktionsrollen je Domäne */}
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-leise">
              Funktionsrollen je Domäne
            </p>
            <span className="text-xs text-leise">eine Rolle pro Domäne</span>
          </div>
          <p className="mb-3 text-sm text-leise">
            In verschiedenen Domänen kann diese Person unterschiedliche Rollen tragen — z. B. in
            einer Domäne Logbuchführend, in einer anderen Delegiert.
          </p>

          {entwurf.length === 0 ? (
            <p className="rounded-lg bg-einwand-bg/60 px-3 py-2 text-sm text-einwand-text">
              Jede Person muss mindestens einer Domäne zugeordnet sein.
            </p>
          ) : (
            <div className="space-y-3">
              {entwurf.map((k) => {
                const typ = alleDomaenen.find((d) => d.id === k.domaeneId)?.typ;
                return (
                  <div key={k.domaeneId} className="rounded-xl border border-rahmen p-3">
                    <div className="mb-2.5 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full bg-primaer"
                          aria-hidden="true"
                        />
                        <span className="truncate font-medium text-text">{k.name}</span>
                        {typ && (
                          <span className="shrink-0 text-sm text-leise">
                            · {DOMAENE_TYP_LABEL[typ]}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        aria-label={`${k.name} entfernen`}
                        title="Aus Domäne entfernen"
                        disabled={speichert}
                        onClick={() => domaeneEntfernen(k.domaeneId)}
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-leise transition-colors hover:bg-flaeche-3 hover:text-text disabled:opacity-50"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {ROLLEN_WAHL.map((r) => {
                        const gewaehlt = k.rolle === r;
                        return (
                          <button
                            key={r}
                            type="button"
                            disabled={speichert}
                            aria-pressed={gewaehlt}
                            onClick={() => rolleSetzen(k.domaeneId, r)}
                            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${
                              gewaehlt
                                ? 'border-primaer bg-primaer text-primaer-text'
                                : 'border-rahmen bg-flaeche text-text hover:bg-flaeche-3'
                            }`}
                          >
                            {rolleLabel(r)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Domäne hinzufügen */}
          {verfuegbar.length > 0 &&
            (domaeneWaehlen ? (
              <Auswahl
                className="mt-3"
                aria-label="Domäne wählen"
                value=""
                onChange={(e) => e.target.value && domaeneHinzufuegen(e.target.value)}
              >
                <option value="">– Domäne wählen –</option>
                {verfuegbar.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </Auswahl>
            ) : (
              <button
                type="button"
                disabled={speichert}
                onClick={() => setDomaeneWaehlen(true)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-rahmen bg-flaeche px-4 py-2.5 text-sm font-medium text-text transition-colors hover:bg-flaeche-3 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" aria-hidden="true" /> Domäne hinzufügen
              </button>
            ))}
        </div>

        <p className="text-xs text-leise">
          Änderungen werden erst mit „Speichern" übernommen. Genau eine Funktionsrolle pro Domäne;
          „Teilhabend" bedeutet Mitglied ohne Sonderrolle.
        </p>

        {/* Kontozugang */}
        <div className="rounded-xl border border-rahmen p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-leise">
            Kontozugang
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-sm text-text">
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 rounded-full ${kontoAktiv ? 'bg-beschluss-rahmen' : 'bg-leise'}`}
              />
              {kontoAktiv ? 'Aktiv — kann sich anmelden' : 'Deaktiviert — kann sich nicht anmelden'}
            </span>
            {kontoAktiv ? (
              <button
                type="button"
                disabled={speichert}
                onClick={() => setKontoAktiv(false)}
                className="inline-flex items-center gap-2 rounded-lg border border-gefahr px-4 py-2 text-sm font-medium text-gefahr transition-colors hover:bg-gefahr/5 disabled:opacity-50"
              >
                <Ban className="h-4 w-4" aria-hidden="true" /> Deaktivieren
              </button>
            ) : (
              <Knopf variante="sekundaer" disabled={speichert} onClick={() => setKontoAktiv(true)}>
                Reaktivieren
              </Knopf>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
