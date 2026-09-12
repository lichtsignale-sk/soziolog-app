import { useEffect, useMemo, useState } from 'react';
import { Users, Plus, PencilLine, RotateCcw, Archive } from 'lucide-react';
import type {
  DomaeneKnotenDTO,
  AdminPersonDTO,
  DomaeneMitgliederDTO,
  RolleTyp,
} from '@soziolog/shared';
import { apiFetch, ApiError } from '../../lib/api-client';
import { ROLLEN, ROLLEN_LABEL } from '../../lib/rollen';
import { DOMAENE_TYP_LABEL } from '../../lib/labels';
import { Knopf, Abzeichen, Dialog, Auswahl, Spinner, useToast } from '@soziolog/ui';
import { DomaeneArchivierenDialog } from '../DomaeneArchivieren';
import { DomaeneModal } from './DomaeneModal';

/** Flacht die Domänen hierarchisch ab (Eltern vor Kindern, je Ebene sortiert). */
function flachHierarchie(domaenen: DomaeneKnotenDTO[]): { k: DomaeneKnotenDTO; tiefe: number }[] {
  const kinder = new Map<string | null, DomaeneKnotenDTO[]>();
  for (const k of domaenen) {
    const key = k.elternDomaeneId;
    if (!kinder.has(key)) kinder.set(key, []);
    kinder.get(key)!.push(k);
  }
  for (const liste of kinder.values()) liste.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const out: { k: DomaeneKnotenDTO; tiefe: number }[] = [];
  const rekursiv = (eltern: string | null, tiefe: number) => {
    for (const k of kinder.get(eltern) ?? []) {
      out.push({ k, tiefe });
      rekursiv(k.id, tiefe + 1);
    }
  };
  rekursiv(null, 0);
  return out;
}

/** Quadrat-Marker: voll = Hauptdomäne, hohl = Unterdomäne. */
function Marker({ voll }: { voll: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-3 w-3 shrink-0 rounded-[3px] ${
        voll ? 'bg-primaer' : 'border-2 border-primaer bg-primaer-soft'
      }`}
    />
  );
}

/** Runder Icon-Button für die Zeilenaktionen (deutlich als Button erkennbar). */
function AktionKnopf({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-lg border border-rahmen bg-flaeche text-leise transition-colors hover:bg-flaeche-3 hover:text-text"
    >
      {children}
    </button>
  );
}

export function DomaenenBereich() {
  const toast = useToast();
  const [domaenen, setDomaenen] = useState<DomaeneKnotenDTO[] | null>(null);
  const [personen, setPersonen] = useState<AdminPersonDTO[] | null>(null);

  // Anlegen/Bearbeiten-Modal (M6).
  const [modal, setModal] = useState<{ modus: 'anlegen' | 'bearbeiten'; domaene?: DomaeneKnotenDTO } | null>(null);
  // Mitglieder-verwalten-Dialog.
  const [verwalteId, setVerwalteId] = useState<string | null>(null);
  const [verwalteDetail, setVerwalteDetail] = useState<DomaeneMitgliederDTO | null>(null);
  const [neuMitgliedId, setNeuMitgliedId] = useState('');
  const [neueRolle, setNeueRolle] = useState<Record<string, RolleTyp | ''>>({});
  // Archivieren-Dialog.
  const [archivZiel, setArchivZiel] = useState<{ id: string; name: string } | null>(null);

  function ladeDomaenen() {
    apiFetch<DomaeneKnotenDTO[]>('/api/domaenen')
      .then(setDomaenen)
      .catch(() => setDomaenen([]));
  }
  function ladePersonen() {
    apiFetch<AdminPersonDTO[]>('/api/admin/personen')
      .then(setPersonen)
      .catch(() => setPersonen([]));
  }

  useEffect(() => {
    ladeDomaenen();
    ladePersonen();
  }, []);

  // Aktive Domänen als Hierarchie; archivierte separat (flach) für die untere Liste.
  const aktiveZeilen = useMemo(
    () => flachHierarchie((domaenen ?? []).filter((d) => !d.archiviert)),
    [domaenen],
  );
  const archivierte = useMemo(
    () =>
      (domaenen ?? [])
        .filter((d) => d.archiviert)
        .sort((a, b) => a.name.localeCompare(b.name, 'de')),
    [domaenen],
  );

  async function domaeneWiederbeleben(id: string) {
    try {
      await apiFetch(`/api/admin/domaenen/${id}/wiederbeleben`, { method: 'POST' });
      toast.zeige('Domäne wiederbelebt.');
      ladeDomaenen();
    } catch (e) {
      toast.zeige(
        e instanceof ApiError ? e.fehler.nachricht : 'Wiederbeleben fehlgeschlagen.',
        'fehler',
      );
    }
  }

  // --- Mitglieder verwalten ---

  function mitgliederOeffnen(domaeneId: string) {
    setVerwalteId(domaeneId);
    ladeVerwalteDetail(domaeneId);
  }
  function ladeVerwalteDetail(domaeneId: string) {
    apiFetch<DomaeneMitgliederDTO>(`/api/admin/domaenen/${domaeneId}/mitglieder`)
      .then(setVerwalteDetail)
      .catch(() => setVerwalteDetail(null));
  }

  async function mitgliedHinzufuegen() {
    if (!verwalteId || !neuMitgliedId) return;
    try {
      await apiFetch(`/api/admin/domaenen/${verwalteId}/mitglieder`, {
        method: 'POST',
        body: JSON.stringify({ personId: neuMitgliedId }),
      });
      toast.zeige('Mitglied hinzugefügt.');
      setNeuMitgliedId('');
      ladeVerwalteDetail(verwalteId);
      ladePersonen();
    } catch (e) {
      toast.zeige(e instanceof ApiError ? e.fehler.nachricht : 'Hinzufügen fehlgeschlagen.', 'fehler');
    }
  }

  async function mitgliedschaftBeenden(mitgliedschaftId: string) {
    if (!verwalteId) return;
    try {
      await apiFetch(`/api/admin/mitgliedschaften/${mitgliedschaftId}`, { method: 'DELETE' });
      toast.zeige('Mitgliedschaft beendet.');
      ladeVerwalteDetail(verwalteId);
      ladePersonen();
    } catch (e) {
      toast.zeige(e instanceof ApiError ? e.fehler.nachricht : 'Beenden fehlgeschlagen.', 'fehler');
    }
  }

  async function rolleZuweisen(personId: string) {
    const rolle = neueRolle[personId];
    if (!verwalteId || !rolle) return;
    try {
      await apiFetch(`/api/admin/domaenen/${verwalteId}/rollen`, {
        method: 'POST',
        body: JSON.stringify({ personId, rolleTyp: rolle }),
      });
      toast.zeige('Rolle zugewiesen.');
      setNeueRolle((r) => ({ ...r, [personId]: '' }));
      ladeVerwalteDetail(verwalteId);
    } catch (e) {
      toast.zeige(e instanceof ApiError ? e.fehler.nachricht : 'Zuweisen fehlgeschlagen.', 'fehler');
    }
  }

  async function rolleBeenden(rollenId: string) {
    if (!verwalteId) return;
    try {
      await apiFetch(`/api/admin/rollen/${rollenId}`, { method: 'DELETE' });
      toast.zeige('Rolle beendet.');
      ladeVerwalteDetail(verwalteId);
    } catch (e) {
      toast.zeige(e instanceof ApiError ? e.fehler.nachricht : 'Beenden fehlgeschlagen.', 'fehler');
    }
  }

  const verwalteteDomaene = (domaenen ?? []).find((k) => k.id === verwalteId);
  const nichtMitglied = (personen ?? []).filter(
    (p) => !verwalteDetail?.mitglieder.some((m) => m.personId === p.id),
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-leise">Alle Domänen der Organisation, hierarchisch.</p>
        <Knopf onClick={() => setModal({ modus: 'anlegen' })}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Neue Domäne
        </Knopf>
      </div>

      {domaenen === null ? (
        <Spinner />
      ) : (
        <div className="divide-y divide-rahmen overflow-hidden rounded-2xl border border-rahmen bg-flaeche shadow-karte">
          {aktiveZeilen.map(({ k, tiefe }) => (
            <div
              key={k.id}
              className="flex items-center gap-3 py-3.5 pr-3"
              style={{ paddingLeft: `${16 + tiefe * 28}px` }}
            >
              <Marker voll={tiefe === 0} />
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate font-semibold text-text">{k.name}</span>
                <span className="shrink-0 text-sm text-leise">· {DOMAENE_TYP_LABEL[k.typ]}</span>
              </div>
              <span className="shrink-0 text-sm text-leise">
                <span className="ziffern-tabellarisch font-medium text-text">
                  {k.anzahlBeschluesse}
                </span>{' '}
                Beschlüsse
              </span>
              <div className="flex shrink-0 items-center gap-1 pl-3">
                <AktionKnopf label={`${k.name} bearbeiten`} onClick={() => setModal({ modus: 'bearbeiten', domaene: k })}>
                  <PencilLine className="h-4 w-4" aria-hidden="true" />
                </AktionKnopf>
                <AktionKnopf label={`Mitglieder von ${k.name}`} onClick={() => mitgliederOeffnen(k.id)}>
                  <Users className="h-4 w-4" aria-hidden="true" />
                </AktionKnopf>
                <AktionKnopf label={`${k.name} archivieren`} onClick={() => setArchivZiel({ id: k.id, name: k.name })}>
                  <Archive className="h-4 w-4" aria-hidden="true" />
                </AktionKnopf>
              </div>
            </div>
          ))}
        </div>
      )}

      {archivierte.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-leise">
            Archivierte Domänen
          </h2>
          <div className="divide-y divide-rahmen overflow-hidden rounded-2xl border border-rahmen bg-flaeche shadow-karte">
            {archivierte.map((k) => (
              <div key={k.id} className="flex items-center gap-3 py-3.5 pl-4 pr-3">
                <Marker voll={k.elternDomaeneId === null} />
                <div className="flex min-w-0 flex-1 items-center gap-2 opacity-70">
                  <span className="truncate font-semibold text-text">{k.name}</span>
                  <span className="shrink-0 text-sm text-leise">· {DOMAENE_TYP_LABEL[k.typ]}</span>
                  <Abzeichen className="bg-flaeche-3 text-leise">Archiviert</Abzeichen>
                </div>
                <span className="shrink-0 text-sm text-leise opacity-70">
                  <span className="ziffern-tabellarisch font-medium text-text">
                    {k.anzahlBeschluesse}
                  </span>{' '}
                  Beschlüsse
                </span>
                <div className="flex shrink-0 items-center pl-3">
                  <Knopf variante="sekundaer" onClick={() => domaeneWiederbeleben(k.id)}>
                    <RotateCcw className="h-4 w-4" aria-hidden="true" /> Wiederbeleben
                  </Knopf>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Anlegen/Bearbeiten */}
      {modal && (
        <DomaeneModal
          modus={modal.modus}
          domaene={modal.domaene}
          domaenen={domaenen ?? []}
          personen={personen ?? []}
          onGespeichert={ladeDomaenen}
          onSchliessen={() => setModal(null)}
        />
      )}

      {/* Mitglieder verwalten */}
      <Dialog
        offen={verwalteId !== null}
        eyebrow="Mitglieder verwalten"
        titel={verwalteteDomaene?.name ?? ''}
        groesse="lg"
        onSchliessen={() => {
          setVerwalteId(null);
          setVerwalteDetail(null);
        }}
      >
        {verwalteteDomaene && (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-text">Mitglieder & Rollen</h3>
            <p className="mb-3 text-xs text-leise">
              Funktionsrollen werden hier je Domäne vergeben; die
              Software-Berechtigung leitet sich daraus ab.
            </p>
            {verwalteDetail === null ? (
              <Spinner />
            ) : (
              <div className="space-y-3">
                {verwalteDetail.mitglieder.map((m) => (
                  <div key={m.mitgliedschaftId} className="rounded-lg border border-rahmen p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-text">{m.name}</span>
                        {m.rollen.map((r) => (
                          <Abzeichen key={r.rollenId} className="bg-flaeche-3 text-leise">
                            {ROLLEN_LABEL[r.rolleTyp]}
                            <button
                              type="button"
                              aria-label={`Rolle ${ROLLEN_LABEL[r.rolleTyp]} beenden`}
                              onClick={() => rolleBeenden(r.rollenId)}
                              className="ml-1"
                            >
                              ×
                            </button>
                          </Abzeichen>
                        ))}
                      </div>
                      <Knopf
                        variante="ghost"
                        className="text-xs"
                        onClick={() => mitgliedschaftBeenden(m.mitgliedschaftId)}
                      >
                        Mitgliedschaft beenden
                      </Knopf>
                    </div>
                    <div className="flex items-center gap-2">
                      <Auswahl
                        aria-label={`Rolle für ${m.name} zuweisen`}
                        value={neueRolle[m.personId] ?? ''}
                        onChange={(e) =>
                          setNeueRolle((r) => ({ ...r, [m.personId]: e.target.value as RolleTyp }))
                        }
                      >
                        <option value="">– Rolle zuweisen –</option>
                        {ROLLEN.map((r) => (
                          <option key={r} value={r}>
                            {ROLLEN_LABEL[r]}
                          </option>
                        ))}
                      </Auswahl>
                      <Knopf
                        variante="ghost"
                        className="text-xs"
                        disabled={!neueRolle[m.personId]}
                        onClick={() => rolleZuweisen(m.personId)}
                      >
                        Zuweisen
                      </Knopf>
                    </div>
                  </div>
                ))}

                <div className="flex flex-wrap items-center gap-2 border-t border-rahmen pt-3">
                  <Auswahl
                    aria-label="Person als Mitglied hinzufügen"
                    value={neuMitgliedId}
                    onChange={(e) => setNeuMitgliedId(e.target.value)}
                  >
                    <option value="">– Person auswählen –</option>
                    {nichtMitglied.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Auswahl>
                  <Knopf
                    variante="sekundaer"
                    className="text-xs"
                    disabled={!neuMitgliedId}
                    onClick={mitgliedHinzufuegen}
                  >
                    Mitglied hinzufügen
                  </Knopf>
                </div>
              </div>
            )}
          </section>
        )}
      </Dialog>

      {archivZiel && (
        <DomaeneArchivierenDialog
          domaeneId={archivZiel.id}
          domaeneName={archivZiel.name}
          onSchliessen={() => setArchivZiel(null)}
          onArchiviert={ladeDomaenen}
        />
      )}
    </div>
  );
}
