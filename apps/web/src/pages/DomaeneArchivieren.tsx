import { useEffect, useState } from 'react';
import type { ArchivierenVorschau, ArchivierenAktion } from '@soziolog/shared';
import { apiFetch, ApiError } from '../lib/api-client';
import { Knopf, Dialog, Auswahl, Abzeichen, Spinner, useToast } from '@soziolog/ui';

interface Entscheidung {
  aktion: ArchivierenAktion;
  zielDomaeneId?: string;
}

/**
 * Gesteuerter Archivieren-Dialog für eine konkrete Domäne. Lädt beim Öffnen die
 * Vorschau (verwaiste Personen, aktive Unter-Domänen) und lässt je verwaister
 * Person entscheiden (in andere Domäne behalten oder Zugang entziehen), bevor
 * archiviert wird. Nichts wird gelöscht – Einträge bleiben im Log erhalten.
 */
export function DomaeneArchivierenDialog({
  domaeneId,
  domaeneName,
  onSchliessen,
  onArchiviert,
}: {
  domaeneId: string;
  domaeneName: string;
  onSchliessen: () => void;
  onArchiviert: () => void;
}) {
  const toast = useToast();
  const [vorschau, setVorschau] = useState<ArchivierenVorschau | null>(null);
  const [entscheidungen, setEntscheidungen] = useState<Record<string, Entscheidung>>({});
  const [sendet, setSendet] = useState(false);

  useEffect(() => {
    let abgebrochen = false;
    apiFetch<ArchivierenVorschau>(`/api/admin/domaenen/${domaeneId}/archivieren-vorschau`)
      .then((v) => {
        if (!abgebrochen) {
          setVorschau(v);
          setEntscheidungen({});
        }
      })
      .catch((e) => {
        toast.zeige(
          e instanceof ApiError ? e.fehler.nachricht : 'Vorschau fehlgeschlagen.',
          'fehler',
        );
        onSchliessen();
      });
    return () => {
      abgebrochen = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domaeneId]);

  function setAktion(personId: string, aktion: ArchivierenAktion) {
    setEntscheidungen((e) => ({ ...e, [personId]: { ...e[personId], aktion } }));
  }
  function setZiel(personId: string, zielDomaeneId: string) {
    setEntscheidungen((e) => ({
      ...e,
      [personId]: { aktion: e[personId]?.aktion ?? 'behalten_in_domaene', zielDomaeneId },
    }));
  }

  const vollstaendig =
    !vorschau?.hatAktiveUnterDomaenen &&
    (vorschau?.verwaisende.every((v) => {
      const e = entscheidungen[v.personId];
      if (!e) return false;
      return e.aktion === 'loeschen' || !!e.zielDomaeneId;
    }) ??
      false);

  async function archivieren() {
    if (!vorschau) return;
    setSendet(true);
    try {
      await apiFetch(`/api/admin/domaenen/${vorschau.domaeneId}/archivieren`, {
        method: 'POST',
        body: JSON.stringify({
          entscheidungen: vorschau.verwaisende.map((v) => ({
            personId: v.personId,
            aktion: entscheidungen[v.personId].aktion,
            zielDomaeneId: entscheidungen[v.personId].zielDomaeneId,
          })),
        }),
      });
      toast.zeige('Domäne archiviert.');
      onArchiviert();
      onSchliessen();
    } catch (e) {
      toast.zeige(
        e instanceof ApiError ? e.fehler.nachricht : 'Archivieren fehlgeschlagen.',
        'fehler',
      );
    } finally {
      setSendet(false);
    }
  }

  return (
    <Dialog
      offen
      titel={`Domäne „${domaeneName}" archivieren`}
      onSchliessen={onSchliessen}
      fussleiste={
        vorschau ? (
          <div className="flex justify-end gap-2">
            <Knopf variante="ghost" onClick={onSchliessen}>
              Abbrechen
            </Knopf>
            <Knopf variante="gefahr" laedt={sendet} disabled={!vollstaendig} onClick={archivieren}>
              Archivieren
            </Knopf>
          </div>
        ) : undefined
      }
    >
      {vorschau === null ? (
        <Spinner />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-leise">
            {vorschau.hatEintraege
              ? 'Die Domäne wird archiviert; ihre Beschlüsse und Vorschläge bleiben im Log erhalten. Sie kann später wiederbelebt werden.'
              : 'Die Domäne hat keine Einträge. Sie kann später wiederbelebt werden.'}
          </p>

          {vorschau.hatAktiveUnterDomaenen && (
            <p className="rounded-lg border border-rahmen bg-flaeche-2 p-3 text-sm text-gefahr" role="alert">
              Diese Domäne hat noch aktive Unter-Domänen. Archiviere oder verschiebe
              diese zuerst.
            </p>
          )}

          {vorschau.verwaisende.length === 0 ? (
            <p className="rounded-lg border border-rahmen bg-flaeche-2 p-3 text-sm text-text">
              Keine Person verwaist durch diese Archivierung.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-text">
                Diese Personen hätten danach keine Domäne mehr – bitte je Person
                entscheiden:
              </p>
              {vorschau.verwaisende.map((v) => {
                const e = entscheidungen[v.personId];
                return (
                  <div
                    key={v.personId}
                    data-testid={`verwaist-${v.personId}`}
                    className="rounded-lg border border-rahmen p-3"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span className="font-medium text-text">{v.name}</span>
                      {v.rollenImDomaene.map((r) => (
                        <Abzeichen key={r} className="bg-flaeche-3 text-leise">
                          {r}
                        </Abzeichen>
                      ))}
                    </div>
                    <div className="flex flex-col gap-2 text-sm">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`aktion-${v.personId}`}
                          checked={e?.aktion === 'behalten_in_domaene'}
                          onChange={() => setAktion(v.personId, 'behalten_in_domaene')}
                        />
                        In anderer Domäne behalten
                        <Auswahl
                          aria-label={`Ziel-Domäne für ${v.name}`}
                          value={e?.zielDomaeneId ?? ''}
                          disabled={e?.aktion !== 'behalten_in_domaene'}
                          onChange={(ev) => setZiel(v.personId, ev.target.value)}
                        >
                          <option value="">– Ziel-Domäne –</option>
                          {vorschau.zielDomaenen.map((z) => (
                            <option key={z.id} value={z.id}>
                              {z.name}
                            </option>
                          ))}
                        </Auswahl>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`aktion-${v.personId}`}
                          checked={e?.aktion === 'loeschen'}
                          onChange={() => setAktion(v.personId, 'loeschen')}
                        />
                        Zugang entziehen (Person deaktivieren)
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
