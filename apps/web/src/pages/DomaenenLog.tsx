import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { FileText, Search, Plus, Download } from 'lucide-react';
import type {
  DomaeneDetailDTO,
  DomaeneMitgliedNameDTO,
  VorschlagDTO,
  VorschlagStatus,
} from '@soziolog/shared';
import { apiFetch, ladePdf, ApiError } from '../lib/api-client';
import { useAuth } from '../context/AuthContext';
import { useToast, Knopf, Dialog, LeerZustand, Spinner } from '@soziolog/ui';
import { Breadcrumb } from '../components/Breadcrumb';
import { TeilhabendenReihe } from '../components/TeilhabendenReihe';
import { VorschlagKarte } from '../components/VorschlagKarte';
import { VorschlagFelder } from '../components/VorschlagFelder';
import { NeuerVorschlagModal } from '../components/NeuerVorschlagModal';
import { DOMAENE_TYP_LABEL } from '../lib/labels';

type StatusFilter = 'alle' | Extract<VorschlagStatus, 'offen' | 'entschieden'>;

const STATUS_FILTER: { schluessel: StatusFilter; label: string }[] = [
  { schluessel: 'alle', label: 'Alle' },
  { schluessel: 'offen', label: 'Offen' },
  { schluessel: 'entschieden', label: 'Entschieden' },
];

export function DomaenenLog() {
  const { domaeneId } = useParams<{ domaeneId: string }>();
  const [suchParams, setSuchParams] = useSearchParams();
  const { person } = useAuth();
  const toast = useToast();
  const [exportLaedt, setExportLaedt] = useState(false);

  async function exportiere() {
    if (!domaeneId) return;
    setExportLaedt(true);
    try {
      await ladePdf(`/api/export/domaenen/${domaeneId}/pdf`, `domaene-${domaeneId}.pdf`);
    } catch (e) {
      toast.zeige(e instanceof ApiError ? e.fehler.nachricht : 'Export fehlgeschlagen.', 'fehler');
    } finally {
      setExportLaedt(false);
    }
  }
  const [domaene, setDomaene] = useState<DomaeneDetailDTO | null>(null);
  const [mitglieder, setMitglieder] = useState<DomaeneMitgliedNameDTO[]>([]);
  const [vorschlaege, setVorschlaege] = useState<VorschlagDTO[] | null>(null);
  const [modalVorschlag, setModalVorschlag] = useState<VorschlagDTO | null>(null);
  const [neuVorschlagOffen, setNeuVorschlagOffen] = useState(false);
  // Gesetzt, wenn der neue Vorschlag eine Neufassung ist (löst diesen Beschluss ab).
  const [neufassungFuer, setNeufassungFuer] = useState<string | undefined>(undefined);

  const [suche, setSuche] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('alle');

  const darfSchreiben =
    !!person?.istAdmin ||
    !!person?.domaenen.find((k) => k.domaeneId === domaeneId)?.rollen.includes('logbuchfuehrer');

  useEffect(() => {
    apiFetch<DomaeneDetailDTO>(`/api/domaenen/${domaeneId}`).then(setDomaene).catch(() => setDomaene(null));
    apiFetch<VorschlagDTO[]>(`/api/domaenen/${domaeneId}/vorschlaege`)
      .then(setVorschlaege)
      .catch(() => setVorschlaege([]));
    apiFetch<DomaeneMitgliedNameDTO[]>(`/api/domaenen/${domaeneId}/mitglieder`)
      .then(setMitglieder)
      .catch(() => setMitglieder([]));
  }, [domaeneId]);

  // Deep-Link aus dem Gesamt-Log: ?vorschlag=<id> öffnet das Detail-Modal.
  useEffect(() => {
    if (vorschlaege === null) return;
    const id = suchParams.get('vorschlag');
    if (!id) return;
    const treffer = vorschlaege.find((v) => v.id === id);
    if (treffer) setModalVorschlag(treffer);
    // Parameter entfernen, damit erneutes Schließen ihn nicht wieder öffnet.
    suchParams.delete('vorschlag');
    setSuchParams(suchParams, { replace: true });
  }, [vorschlaege, suchParams, setSuchParams]);

  // Deep-Link „Ersetzen": ?neufassung=<beschlussId> öffnet das Neufassungs-Formular.
  useEffect(() => {
    const beschlussId = suchParams.get('neufassung');
    if (!beschlussId) return;
    setModalVorschlag(null);
    setNeufassungFuer(beschlussId);
    setNeuVorschlagOffen(true);
    suchParams.delete('neufassung');
    setSuchParams(suchParams, { replace: true });
  }, [suchParams, setSuchParams]);

  const gefiltert = useMemo(() => {
    if (!vorschlaege) return [];
    const suchbegriff = suche.trim().toLowerCase();
    return vorschlaege.filter((v) => {
      if (statusFilter !== 'alle' && v.status !== statusFilter) return false;
      if (!suchbegriff) return true;
      return (
        v.titel.toLowerCase().includes(suchbegriff) ||
        v.inhalt.toLowerCase().includes(suchbegriff) ||
        (v.beschluss?.inhalt.toLowerCase().includes(suchbegriff) ?? false)
      );
    });
  }, [vorschlaege, suche, statusFilter]);

  if (!domaene || vorschlaege === null) return <Spinner />;

  return (
    <div>
      {/* Vollflächige, hellere Kopf-Bande mit durchgezogener Trennlinie */}
      <div className="-mx-4 -mt-6 mb-6 border-b border-rahmen bg-flaeche px-4 pb-6 pt-6 lg:-mx-8 lg:-mt-7 lg:px-8 lg:pt-7">
      <Breadcrumb
        glieder={[
          { label: 'Domänen', zu: '/' },
          ...(domaene.elternDomaeneName && domaene.elternDomaeneId
            ? [{ label: domaene.elternDomaeneName, zu: `/domaenen/${domaene.elternDomaeneId}` }]
            : []),
          { label: domaene.name },
        ]}
      />

      {/* Kopf */}
      <div className="mt-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-3xl font-bold text-text">{domaene.name}</h1>
            <span className="rounded-full bg-primaer-soft px-2.5 py-0.5 text-xs font-semibold text-primaer-softtext">
              {DOMAENE_TYP_LABEL[domaene.typ]}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Knopf variante="sekundaer" laedt={exportLaedt} onClick={exportiere}>
              <Download className="h-4 w-4" aria-hidden="true" />
              PDF-Export
            </Knopf>
            {darfSchreiben && (
              <Knopf onClick={() => setNeuVorschlagOffen(true)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Neuer Vorschlag
              </Knopf>
            )}
          </div>
        </div>

        {/* ZIEL + DOMÄNENAUFGABEN nebeneinander */}
        <div className="mt-5 grid max-w-4xl gap-x-12 gap-y-5 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-leise">Ziel</p>
            <p className="mt-1 font-serif text-base leading-relaxed text-read">
              {domaene.ziel}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-leise">
              Domänenaufgaben
            </p>
            <ul className="mt-1.5 space-y-1">
              {domaene.tasks.map((aufgabe, i) => (
                <li key={i} className="flex gap-2 text-sm text-text">
                  <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primaer" />
                  <span>{aufgabe}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {mitglieder.length > 0 && (
          <div className="mt-6">
            <TeilhabendenReihe mitglieder={mitglieder} />
          </div>
        )}
        </div>
      </div>

      {/* Such-/Filterleiste – ohne Karten-Umrandung, direkt auf dem Grund */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[260px] flex-1 md:max-w-lg">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-leise"
            aria-hidden="true"
          />
          <input
            type="search"
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            placeholder="Vorschläge, Inhalte und Beschlüsse durchsuchen…"
            aria-label="Vorschläge durchsuchen"
            className="w-full rounded-lg border border-rahmen bg-flaeche py-2 pl-9 pr-3 text-sm text-text placeholder:text-leise focus:border-primaer focus:outline-none"
          />
        </div>
        <div className="inline-flex gap-1 rounded-lg border border-rahmen bg-flaeche-3 p-1">
          {STATUS_FILTER.map((f) => (
            <button
              key={f.schluessel}
              type="button"
              onClick={() => setStatusFilter(f.schluessel)}
              aria-pressed={statusFilter === f.schluessel}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                statusFilter === f.schluessel
                  ? 'bg-flaeche text-text shadow-karte'
                  : 'text-leise hover:text-text'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="ml-auto shrink-0 text-sm text-leise">
          <span className="ziffern-tabellarisch font-medium text-text">{gefiltert.length}</span>{' '}
          {gefiltert.length === 1 ? 'Vorschlag' : 'Vorschläge'}
        </span>
      </div>

      {vorschlaege.length === 0 ? (
        <LeerZustand
          Icon={FileText}
          titel="Noch keine Vorschläge"
          hinweis={
            darfSchreiben
              ? 'Lege den ersten Vorschlag für diese Domäne an.'
              : 'Sobald ein Protokollführer einen Vorschlag anlegt, erscheint er hier.'
          }
        />
      ) : gefiltert.length === 0 ? (
        <LeerZustand
          Icon={Search}
          titel="Nichts gefunden"
          hinweis={
            suche.trim()
              ? `Für „${suche.trim()}" gibt es in dieser Domäne keine Treffer.`
              : 'Für diesen Filter gibt es in dieser Domäne keine Treffer.'
          }
        />
      ) : (
        <div className="space-y-4">
          {gefiltert.map((v) => (
            <div key={v.id} data-testid={`vorschlag-${v.id}`}>
              <VorschlagKarte vorschlag={v} onOeffnen={() => setModalVorschlag(v)} />
            </div>
          ))}
        </div>
      )}

      <NeuerVorschlagModal
        offen={neuVorschlagOffen}
        domaeneId={domaeneId!}
        ersetztBeschlussId={neufassungFuer}
        onSchliessen={() => {
          setNeuVorschlagOffen(false);
          setNeufassungFuer(undefined);
        }}
        onErstellt={(v) => {
          setVorschlaege((liste) => [v, ...(liste ?? [])]);
          setNeuVorschlagOffen(false);
          setNeufassungFuer(undefined);
          setModalVorschlag(v);
        }}
      />

      {/* Detail-Modal */}
      <Dialog
        offen={modalVorschlag !== null}
        titel=""
        onSchliessen={() => setModalVorschlag(null)}
        groesse="xl"
        eigenerKopf
      >
        {modalVorschlag && (
          <VorschlagFelder
            vorschlag={modalVorschlag}
            korrigierbar={darfSchreiben}
            onAktualisiert={(v) => {
              setModalVorschlag(v);
              setVorschlaege((liste) => liste?.map((x) => (x.id === v.id ? v : x)) ?? liste);
            }}
          />
        )}
      </Dialog>
    </div>
  );
}
