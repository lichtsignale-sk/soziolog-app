import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import type {
  GesamtLogDomaene,
  GesamtLogSpanne,
  GesamtLogPunkt,
  GueltigkeitStatus,
  VorschlagDTO,
} from '@soziolog/shared';
import { heute, zuDatum, datumPlusTage, giltAmStichtag } from '@soziolog/shared';
import { apiFetch } from '../lib/api-client';
import { formatDatum } from '../utils/datum';
import { GUELTIGKEIT_STATUS_LABEL as STATUS_LABEL } from '../lib/labels';
import { useAuth } from '../context/AuthContext';
import { statusBadge } from '../lib/farben';
import { Karte, DatumFeld, Dialog, Abzeichen, LeerZustand, Spinner } from '@soziolog/ui';
import { VorschlagFelder } from '../components/VorschlagFelder';

const MS_TAG = 86_400_000;
const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

/** Ganze Kalendertage zwischen a und b (UTC-basiert, zeitzonensicher). */
function tagAbstand(a: string, b: string): number {
  return Math.round((zuDatum(b).getTime() - zuDatum(a).getTime()) / MS_TAG);
}

/**
 * Fasst Beschluss-Spannen zu Ablösungsketten zusammen: eine Kette beginnt bei
 * einer Wurzel (keine oder eine nicht im Fenster geladene Vorgänger-Spanne) und
 * folgt über ersetztBeschlussId den Nachfolgern. Jede Kette wird zu EINER Zeile
 * im Verlauf – die Segmente schließen zeitlich aneinander an.
 */
function baueKetten(spannen: GesamtLogSpanne[]): GesamtLogSpanne[][] {
  const vorhanden = new Set(spannen.map((s) => s.id));
  const nachfolger = new Map<string, GesamtLogSpanne>();
  for (const s of spannen) {
    if (s.ersetztBeschlussId) nachfolger.set(s.ersetztBeschlussId, s);
  }
  const ketten: GesamtLogSpanne[][] = [];
  for (const s of spannen) {
    const istWurzel = !s.ersetztBeschlussId || !vorhanden.has(s.ersetztBeschlussId);
    if (!istWurzel) continue;
    const kette = [s];
    let cur = s;
    while (nachfolger.has(cur.id)) {
      cur = nachfolger.get(cur.id)!;
      kette.push(cur);
    }
    ketten.push(kette);
  }
  return ketten.sort((a, b) => (a[0].gueltigAb < b[0].gueltigAb ? -1 : 1));
}

/** Balken-Farbe eines Kettensegments je Gültigkeitsstatus. */
function segmentFarbe(status: GueltigkeitStatus): string {
  if (status === 'in_ueberpruefung') return 'bg-bedenken-rahmen';
  // Historische Segmente (ersetzt/beendet) gedämpft, aktuelle voll.
  if (status === 'ersetzt' || status === 'beendet') return 'bg-beschluss-rahmen/50';
  return 'bg-beschluss-rahmen';
}

/** Status-Pille (Liste) je Gültigkeitsstatus. */
function gueltigkeitBadge(status: GueltigkeitStatus): string {
  switch (status) {
    case 'gueltig':
      return 'bg-beschluss-bg text-beschluss-text';
    case 'in_ueberpruefung':
      return 'bg-bedenken-bg text-bedenken-text';
    default:
      return 'bg-flaeche-3 text-leise';
  }
}

type Tab = 'verlauf' | 'liste';
type StatusFilter = 'alle' | 'offen' | 'entschieden';

const STATUS_FILTER: { schluessel: StatusFilter; label: string }[] = [
  { schluessel: 'alle', label: 'Alle' },
  { schluessel: 'offen', label: 'Offen' },
  { schluessel: 'entschieden', label: 'Entschieden' },
];

interface SpannenReihe {
  art: 'spanne';
  domaeneId: string;
  domaeneName: string;
  s: GesamtLogSpanne;
}
interface PunktReihe {
  art: 'punkt';
  domaeneId: string;
  domaeneName: string;
  v: GesamtLogPunkt;
}
type Reihe = SpannenReihe | PunktReihe;

interface KettenReihe {
  art: 'kette';
  domaeneId: string;
  domaeneName: string;
  spannen: GesamtLogSpanne[];
}
type VerlaufReihe = KettenReihe | PunktReihe;

export function GesamtLog() {
  const { person } = useAuth();
  // Standard-Zeitfenster: ab Jahresanfang bis rund ein Quartal in die Zukunft
  // (deckt den Verlauf inkl. Stichtag großzügig ab).
  const jahresStart = `${heute().slice(0, 4)}-01-01`;
  const [von, setVon] = useState(jahresStart);
  const [bis, setBis] = useState(datumPlusTage(heute(), 90));
  const [daten, setDaten] = useState<GesamtLogDomaene[] | null>(null);
  const [stichtag, setStichtag] = useState(heute());
  const [tab, setTab] = useState<Tab>('verlauf');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('alle');
  const [suche, setSuche] = useState('');
  const [modalVorschlag, setModalVorschlag] = useState<VorschlagDTO | null>(null);

  useEffect(() => {
    setDaten(null);
    apiFetch<GesamtLogDomaene[]>(`/api/gesamt-log?von=${von}&bis=${bis}`)
      .then(setDaten)
      .catch(() => setDaten([]));
  }, [von, bis]);

  const spanneTage = Math.max(1, tagAbstand(von, bis));
  const frac = useMemo(
    () =>
      (datum: string): number =>
        Math.min(1, Math.max(0, tagAbstand(von, datum) / spanneTage)),
    [von, spanneTage],
  );

  // Monatsraster über das Zeitfenster (Label + Position in %).
  const monate = useMemo(() => {
    const dbis = zuDatum(bis);
    const start = zuDatum(von);
    let cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    const marken: { iso: string; label: string; links: number }[] = [];
    while (cur.getTime() <= dbis.getTime()) {
      const iso = cur.toISOString().slice(0, 10);
      marken.push({ iso, label: MONATE[cur.getUTCMonth()], links: frac(iso) * 100 });
      cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
    }
    return marken;
  }, [von, bis, frac]);

  const stichtagFrac = frac(stichtag) * 100;

  const suchbegriff = suche.trim().toLowerCase();
  function spanneTrifft(s: GesamtLogSpanne, domaeneName: string): boolean {
    if (statusFilter === 'offen') return false;
    if (!suchbegriff) return true;
    return (
      s.titel.toLowerCase().includes(suchbegriff) ||
      s.vorschlagInhalt.toLowerCase().includes(suchbegriff) ||
      s.beschlussInhalt.toLowerCase().includes(suchbegriff) ||
      domaeneName.toLowerCase().includes(suchbegriff)
    );
  }
  function punktTrifft(v: GesamtLogPunkt, domaeneName: string): boolean {
    if (statusFilter === 'entschieden') return false;
    if (!suchbegriff) return true;
    return (
      v.titel.toLowerCase().includes(suchbegriff) ||
      v.vorschlagInhalt.toLowerCase().includes(suchbegriff) ||
      domaeneName.toLowerCase().includes(suchbegriff)
    );
  }

  const reihen = useMemo<Reihe[]>(() => {
    if (!daten) return [];
    return daten.flatMap((k) => [
      ...k.spannen
        .filter((s) => spanneTrifft(s, k.domaeneName))
        .map((s): Reihe => ({ art: 'spanne', domaeneId: k.domaeneId, domaeneName: k.domaeneName, s })),
      ...k.offeneVorschlaege
        .filter((v) => punktTrifft(v, k.domaeneName))
        .map((v): Reihe => ({ art: 'punkt', domaeneId: k.domaeneId, domaeneName: k.domaeneName, v })),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daten, statusFilter, suchbegriff]);

  // Verlauf: Spannen zu Ablösungsketten (eine Zeile je Kette) bündeln.
  const verlaufReihen = useMemo<VerlaufReihe[]>(() => {
    if (!daten) return [];
    return daten.flatMap((k) => [
      ...baueKetten(k.spannen)
        .filter((kette) => kette.some((s) => spanneTrifft(s, k.domaeneName)))
        .map((spannen): VerlaufReihe => ({
          art: 'kette',
          domaeneId: k.domaeneId,
          domaeneName: k.domaeneName,
          spannen,
        })),
      ...k.offeneVorschlaege
        .filter((v) => punktTrifft(v, k.domaeneName))
        .map((v): VerlaufReihe => ({ art: 'punkt', domaeneId: k.domaeneId, domaeneName: k.domaeneName, v })),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daten, statusFilter, suchbegriff]);

  if (daten === null) return <Spinner />;

  const korrigierbar =
    !!person?.istAdmin ||
    !!person?.domaenen
      .find((k) => k.domaeneId === modalVorschlag?.domaeneId)
      ?.rollen.includes('logbuchfuehrer');

  async function oeffneVorschlag(vorschlagId: string) {
    const v = await apiFetch<VorschlagDTO>(`/api/vorschlaege/${vorschlagId}`);
    setModalVorschlag(v);
  }

  // Beschluss-Balken: ab dem Beschlussdatum bis zur Frist (befristet) bzw. bis
  // heute (unbefristet – läuft weiter in die Zukunft). Offener Vorschlag: ab dem
  // Vorschlagsdatum ebenfalls bis heute.
  function balkenGeo(vonDatum: string, bisDatum: string | null) {
    const links = frac(vonDatum) * 100;
    const rechts = frac(bisDatum ?? heute()) * 100;
    return { links, breite: Math.max(rechts - links, 1.2) };
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-text">Gesamt-Log</h1>
          <p className="mt-1 max-w-xl text-sm text-leise">
            Der vollständige Entscheidungsweg aller Domänen — zeitgenau
            nachvollziehbar.
          </p>
        </div>
        <div className="inline-flex gap-1 rounded-lg border border-rahmen bg-flaeche-3 p-1">
          {(['verlauf', 'liste'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-md px-4 py-1.5 text-sm font-semibold capitalize transition-colors ${
                tab === t ? 'bg-flaeche text-text shadow-karte' : 'text-leise hover:text-text'
              }`}
            >
              {t === 'verlauf' ? 'Verlauf' : 'Liste'}
            </button>
          ))}
        </div>
      </div>

      {/* Steuerleiste */}
      <Karte className="my-5 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <DatumFeld label="Von" value={von} max={bis} onChange={setVon} />
          </div>
          <div className="w-40">
            <DatumFeld label="Bis" value={bis} min={von} onChange={setBis} />
          </div>
          <div className="mx-1 hidden h-9 w-px self-center bg-rahmen sm:block" />
          <div className="flex gap-1 self-center rounded-lg border border-rahmen bg-flaeche-2 p-0.5">
            {STATUS_FILTER.map((f) => (
              <button
                key={f.schluessel}
                type="button"
                onClick={() => setStatusFilter(f.schluessel)}
                aria-pressed={statusFilter === f.schluessel}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                  statusFilter === f.schluessel
                    ? 'bg-primaer text-primaer-text'
                    : 'text-leise hover:bg-flaeche-3'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative min-w-[180px] flex-1 self-center">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-leise"
              aria-hidden="true"
            />
            <input
              type="search"
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
              placeholder="Alle Vorschläge durchsuchen…"
              aria-label="Vorschläge durchsuchen"
              className="w-full rounded-lg border border-rahmen bg-flaeche py-2 pl-9 pr-3 text-sm text-text placeholder:text-leise focus:border-primaer focus:outline-none"
            />
          </div>
          <div className="w-44 [&_input]:border-primaer">
            {/* Stichtag ist immer aktiv (grüne Linie im Verlauf). */}
            <DatumFeld label="Stand zum Stichtag" value={stichtag} onChange={setStichtag} />
          </div>
        </div>
      </Karte>

      {reihen.length === 0 ? (
        <LeerZustand
          Icon={Search}
          titel="Keine Einträge im Zeitraum"
          hinweis="Passe das Zeitfenster, die Filter oder die Suche an."
        />
      ) : tab === 'verlauf' ? (
        <div className="overflow-x-auto rounded-xl border border-rahmen bg-flaeche">
          <div className="min-w-[52rem]">
            {/* Kopf: „VORSCHLAG" + Monatsraster */}
            <div className="flex border-b border-rahmen">
              <div className="w-56 shrink-0 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-leise">
                Vorschlag
              </div>
              <div className="relative flex-1 py-2">
                {monate.map((m) => (
                  <span
                    key={m.iso}
                    className="absolute text-[11px] text-leise"
                    style={{ left: `${m.links}%` }}
                  >
                    {m.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Zeilen je Ablösungskette bzw. offenem Vorschlag */}
            {verlaufReihen.map((r) => {
              const zeilenTitel =
                r.art === 'kette' ? r.spannen[r.spannen.length - 1].titel : r.v.titel;
              return (
                <div
                  key={r.art === 'kette' ? r.spannen[0].id : r.v.id}
                  className="flex items-stretch border-b border-rahmen last:border-b-0"
                >
                  <div className="w-56 shrink-0 px-4 py-2.5">
                    <Link
                      to={`/domaenen/${r.domaeneId}`}
                      className="text-xs font-medium text-primaer-softtext hover:underline"
                    >
                      {r.domaeneName}
                    </Link>
                    <p className="truncate text-sm text-text" title={zeilenTitel}>
                      {zeilenTitel}
                    </p>
                  </div>
                  <div className="relative flex-1 self-center py-3">
                    {/* Monats-Gitterlinien */}
                    {monate.map((m) => (
                      <span
                        key={m.iso}
                        aria-hidden="true"
                        className="absolute inset-y-0 w-px bg-rahmen/60"
                        style={{ left: `${m.links}%` }}
                      />
                    ))}
                    {/* Stichtag-Linie (grün) */}
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-0 z-10 w-0.5 bg-primaer"
                      style={{ left: `${stichtagFrac}%` }}
                    />
                    {r.art === 'kette'
                      ? r.spannen.map((s, i) => {
                          const { links, breite } = balkenGeo(s.gueltigAb, s.gueltigBis);
                          const gilt = giltAmStichtag(s.gueltigAb, s.gueltigBis, stichtag);
                          const einzeln = r.spannen.length === 1;
                          const erste = i === 0;
                          const letzte = i === r.spannen.length - 1;
                          const rundung = einzeln
                            ? 'rounded-md'
                            : erste
                              ? 'rounded-l-md'
                              : letzte
                                ? 'rounded-r-md'
                                : '';
                          return (
                            <span key={s.id}>
                              {/* Übergangsmarke am Beginn eines Nachfolge-Segments */}
                              {!erste && (
                                <span
                                  aria-hidden="true"
                                  className="absolute top-1/2 z-10 h-6 w-0.5 -translate-y-1/2 bg-flaeche"
                                  style={{ left: `${links}%` }}
                                />
                              )}
                              <button
                                type="button"
                                data-testid={`balken-${s.id}`}
                                data-gilt={gilt}
                                onClick={() => oeffneVorschlag(s.vorschlagId)}
                                title={`${s.titel} · gültig ab ${formatDatum(s.gueltigAb)}${
                                  s.gueltigBis ? ` bis ${formatDatum(s.gueltigBis)}` : ''
                                }`}
                                aria-label={`${s.titel}, Domäne ${r.domaeneName}, ${STATUS_LABEL[s.gueltigkeitStatus]}, gültig ab ${formatDatum(s.gueltigAb)}${
                                  s.gueltigBis ? ` bis ${formatDatum(s.gueltigBis)}` : ' (offen)'
                                }`}
                                className={`absolute top-1/2 h-5 -translate-y-1/2 ${rundung} ${segmentFarbe(
                                  s.gueltigkeitStatus,
                                )} ${gilt ? 'z-20 ring-2 ring-primaer ring-offset-1' : ''}`}
                                style={{ left: `${links}%`, width: `${breite}%`, minWidth: '0.75rem' }}
                              />
                            </span>
                          );
                        })
                      : (() => {
                          const { links, breite } = balkenGeo(r.v.datum, null);
                          const gilt = giltAmStichtag(r.v.datum, null, stichtag);
                          return (
                            <button
                              type="button"
                              data-testid={`punkt-${r.v.id}`}
                              data-gilt={gilt}
                              onClick={() => oeffneVorschlag(r.v.id)}
                              title={`${r.v.titel} · Offener Vorschlag · seit ${formatDatum(r.v.datum)}`}
                              aria-label={`Offener Vorschlag ${r.v.titel}, Domäne ${r.domaeneName}, seit ${formatDatum(r.v.datum)}`}
                              className="absolute top-1/2 h-5 -translate-y-1/2 rounded-md bg-vorschlag-rahmen"
                              style={{ left: `${links}%`, width: `${breite}%`, minWidth: '0.75rem' }}
                            />
                          );
                        })()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legende */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-rahmen px-4 py-3 text-xs text-leise">
            <span className="font-semibold uppercase tracking-wide">Legende</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-6 rounded-sm bg-beschluss-rahmen" /> Beschluss
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-6 rounded-sm bg-vorschlag-rahmen" /> Offener Vorschlag
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3.5 w-0.5 bg-primaer" /> Stichtag
            </span>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-rahmen bg-flaeche">
          <div className="divide-y divide-rahmen">
            {reihen.map((r) =>
              r.art === 'spanne' ? (
                <div key={r.s.id} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-flaeche-2">
                  <Link to={`/domaenen/${r.domaeneId}`} className="text-sm font-medium text-primaer hover:underline">
                    {r.domaeneName}
                  </Link>
                  <button
                    type="button"
                    onClick={() => oeffneVorschlag(r.s.vorschlagId)}
                    className="flex-1 text-left font-serif text-sm font-medium text-text hover:underline"
                  >
                    {r.s.titel}
                  </button>
                  <span className="ziffern-tabellarisch text-xs text-leise">
                    {r.s.gueltigBis
                      ? `Ersetzt am ${formatDatum(r.s.gueltigBis)}`
                      : `Gültig seit ${formatDatum(r.s.gueltigAb)}`}
                  </span>
                  <Abzeichen className={gueltigkeitBadge(r.s.gueltigkeitStatus)}>
                    {STATUS_LABEL[r.s.gueltigkeitStatus]}
                  </Abzeichen>
                </div>
              ) : (
                <div key={r.v.id} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-flaeche-2">
                  <Link to={`/domaenen/${r.domaeneId}`} className="text-sm font-medium text-primaer hover:underline">
                    {r.domaeneName}
                  </Link>
                  <button
                    type="button"
                    onClick={() => oeffneVorschlag(r.v.id)}
                    className="flex-1 text-left font-serif text-sm font-medium text-text hover:underline"
                  >
                    {r.v.titel}
                  </button>
                  <span className="ziffern-tabellarisch text-xs text-leise">
                    Offen seit {formatDatum(r.v.datum)}
                  </span>
                  <Abzeichen className={statusBadge('offen').klasse}>{statusBadge('offen').text}</Abzeichen>
                </div>
              ),
            )}
          </div>
        </div>
      )}

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
            korrigierbar={korrigierbar}
            onAktualisiert={setModalVorschlag}
          />
        )}
      </Dialog>
    </div>
  );
}
