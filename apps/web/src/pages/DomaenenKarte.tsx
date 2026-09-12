import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { hierarchy, tree, type HierarchyNode } from 'd3-hierarchy';
import { Network, ChevronRight, Plus, Minus, Maximize2 } from 'lucide-react';
import type { DomaeneKnotenDTO } from '@soziolog/shared';
import { apiFetch } from '../lib/api-client';
import { DOMAENE_TYP_LABEL } from '../lib/labels';
import { LeerZustand, Spinner } from '@soziolog/ui';

/** Domäne mit aufgebauter Kinderliste (nach Name sortiert). */
interface BaumKnoten extends DomaeneKnotenDTO {
  kinder: BaumKnoten[];
}

/** Baut aus der flachen Liste die (nach Namen sortierten) Wurzelbäume. */
function baueBaum(domaenen: DomaeneKnotenDTO[]): BaumKnoten[] {
  const byId = new Map<string, BaumKnoten>(
    domaenen.map((k) => [k.id, { ...k, kinder: [] }]),
  );
  const wurzeln: BaumKnoten[] = [];
  for (const k of byId.values()) {
    const eltern = k.elternDomaeneId ? byId.get(k.elternDomaeneId) : undefined;
    (eltern ? eltern.kinder : wurzeln).push(k);
  }
  const sortiere = (liste: BaumKnoten[]) => {
    liste.sort((a, b) => a.name.localeCompare(b.name, 'de'));
    liste.forEach((k) => sortiere(k.kinder));
  };
  sortiere(wurzeln);
  return wurzeln;
}

/** Flacht den Baum in Zeilen mit Tiefe ab (Eltern vor Kindern) – für Liste/Nav. */
function flach(knoten: BaumKnoten[], tiefe = 0): { k: BaumKnoten; tiefe: number }[] {
  return knoten.flatMap((k) => [{ k, tiefe }, ...flach(k.kinder, tiefe + 1)]);
}

// ─────────────────────────────────────────────────────── Segmented Control

function Segmented<T extends string>({
  optionen,
  aktiv,
  onWechsel,
  ariaLabel,
}: {
  optionen: { wert: T; label: string }[];
  aktiv: T;
  onWechsel: (w: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex gap-1 rounded-lg border border-rahmen bg-flaeche-3 p-1"
    >
      {optionen.map((o) => {
        const gewaehlt = o.wert === aktiv;
        return (
          <button
            key={o.wert}
            role="tab"
            aria-selected={gewaehlt}
            onClick={() => onWechsel(o.wert)}
            className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${
              gewaehlt
                ? 'bg-flaeche text-text shadow-karte'
                : 'text-leise hover:text-text'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Quadratischer Marker: Hauptdomäne voll grün, Unterdomäne hell mit Rand. */
function Marker({ haupt }: { haupt: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-3 w-3 shrink-0 rounded-[3px] ${
        haupt
          ? 'bg-primaer'
          : 'border-2 border-primaer bg-primaer-soft'
      }`}
    />
  );
}

// ─────────────────────────────────────────────────────────────── Baum-Ansicht

/** Ein Knoten im CSS-Baum (grüne Hauptkarte / helle Kinderkarte / kompakte Enkel-Pille). */
function BaumZelle({
  knoten,
  tiefe,
  onOeffnen,
}: {
  knoten: BaumKnoten;
  tiefe: number;
  onOeffnen: (id: string) => void;
}) {
  const offen = knoten.anzahlOffeneEinwaende;
  let karte;
  if (tiefe === 0) {
    // Hauptdomäne: große grüne Karte mit Avatar-Initiale und Beschluss-Zähler.
    karte = (
      <div
        onClick={() => onOeffnen(knoten.id)}
        className="flex cursor-pointer items-center gap-4 rounded-2xl bg-primaer px-5 py-4 text-primaer-text shadow-[0_4px_14px_rgba(47,106,90,0.22)] transition-transform hover:-translate-y-0.5"
      >
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/20 text-lg font-semibold">
          {knoten.name.charAt(0).toUpperCase()}
        </div>
        <div className="pr-3">
          <p className="text-lg font-semibold leading-tight">{knoten.name}</p>
          <p className="text-sm text-white/80">{DOMAENE_TYP_LABEL[knoten.typ]}</p>
        </div>
        <div className="ml-auto border-l border-white/25 pl-4 text-right">
          <p className="ziffern-tabellarisch text-2xl font-bold leading-none">
            {knoten.anzahlBeschluesse}
          </p>
          <p className="text-xs text-white/80">Beschlüsse</p>
        </div>
      </div>
    );
  } else if (tiefe === 1) {
    // Unterdomäne: grün umrandete, hellgrün gefüllte Karte (wie Legende).
    karte = (
      <div
        onClick={() => onOeffnen(knoten.id)}
        className="min-w-[190px] cursor-pointer rounded-xl border border-primaer bg-primaer-soft px-4 py-3 shadow-karte transition-transform hover:-translate-y-0.5"
      >
        <p className="font-semibold text-primaer-softtext">{knoten.name}</p>
        <p className="mt-1 text-xs text-leise">
          <span className="ziffern-tabellarisch font-medium text-text">
            {knoten.anzahlBeschluesse}
          </span>{' '}
          Beschlüsse
          {offen > 0 && (
            <>
              {' · '}
              <span className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-bedenken-rahmen align-middle" />{' '}
              {offen} offen
            </>
          )}
        </p>
      </div>
    );
  } else {
    // Enkel: kompakte, grün umrandete Pille.
    karte = (
      <div
        onClick={() => onOeffnen(knoten.id)}
        className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-primaer bg-primaer-soft px-3 py-1.5 text-sm shadow-karte transition-transform hover:-translate-y-0.5"
      >
        <span className="font-medium text-primaer-softtext">{knoten.name}</span>
        <span className="ziffern-tabellarisch text-xs text-leise">
          {knoten.anzahlBeschluesse}
        </span>
      </div>
    );
  }

  return (
    <>
      {karte}
      {knoten.kinder.length > 0 && (
        <ul className="baum-ul">
          {knoten.kinder.map((k) => (
            <li key={k.id}>
              <BaumZelle knoten={k} tiefe={tiefe + 1} onOeffnen={onOeffnen} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────── Netz-Ansicht

interface NetzKnoten {
  id: string;
  name: string;
  tiefe: number;
  px: number;
  py: number;
}
interface NetzKante {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Statisch (radial) vorberechnetes Netz je Wurzel; Cluster nebeneinander. */
function baueNetz(wurzeln: BaumKnoten[]): { knoten: NetzKnoten[]; kanten: NetzKante[] } {
  const knoten: NetzKnoten[] = [];
  const kanten: NetzKante[] = [];
  const ring = 130;
  let offsetX = 0;
  for (const w of wurzeln) {
    const h = hierarchy<BaumKnoten>(w, (d) => d.kinder);
    tree<BaumKnoten>()
      .size([2 * Math.PI, (h.height || 1) * ring])
      .separation((a, b) => (a.parent === b.parent ? 1 : 2) / Math.max(a.depth, 1))(h);
    const pos = (n: HierarchyNode<BaumKnoten>) => {
      const winkel = (n.x ?? 0) - Math.PI / 2;
      const radius = n.y ?? 0;
      return { px: offsetX + radius * Math.cos(winkel), py: radius * Math.sin(winkel) };
    };
    for (const n of h.descendants()) {
      const p = pos(n);
      knoten.push({ id: n.data.id, name: n.data.name, tiefe: n.depth, px: p.px, py: p.py });
    }
    for (const l of h.links()) {
      const s = pos(l.source);
      const t = pos(l.target);
      kanten.push({ x1: s.px, y1: s.py, x2: t.px, y2: t.py });
    }
    offsetX += 1.5 * (h.height || 1) * ring + 60;
  }
  return { knoten, kanten };
}

/** Bounding-Box aller Netzknoten (für „einpassen"/Zentrieren). */
function netzGrenzen(knoten: NetzKnoten[]) {
  if (knoten.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  const xs = knoten.map((n) => n.px);
  const ys = knoten.map((n) => n.py);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function NetzAnsicht({
  wurzeln,
  onOeffnen,
}: {
  wurzeln: BaumKnoten[];
  onOeffnen: (id: string) => void;
}) {
  const netz = useMemo(() => baueNetz(wurzeln), [wurzeln]);
  const container = useRef<HTMLDivElement>(null);
  const [t, setT] = useState({ tx: 400, ty: 230, scale: 1 });
  const zieht = useRef<{ x: number; y: number } | null>(null);

  const zoom = (faktor: number) =>
    setT((s) => ({ ...s, scale: Math.min(2.5, Math.max(0.4, s.scale * faktor)) }));

  const einpassen = () => {
    const el = container.current;
    if (!el) return;
    const g = netzGrenzen(netz.knoten);
    const inhaltB = g.maxX - g.minX || 1;
    const inhaltH = g.maxY - g.minY || 1;
    const rand = 90; // Platz für Labels/Ränder
    const scale = Math.min(
      1.4,
      (el.clientWidth - rand) / inhaltB,
      (el.clientHeight - rand) / inhaltH,
    );
    const mitteX = (g.minX + g.maxX) / 2;
    const mitteY = (g.minY + g.maxY) / 2;
    setT({
      tx: el.clientWidth / 2 - mitteX * scale,
      ty: el.clientHeight / 2 - mitteY * scale,
      scale,
    });
  };

  // Beim ersten Rendern (und bei Datenwechsel) den Inhalt einpassen.
  useEffect(einpassen, [netz]);

  return (
    <div
      ref={container}
      className="relative h-[460px] overflow-hidden rounded-xl border border-rahmen bg-flaeche-2"
      onWheel={(e) => {
        e.preventDefault();
        zoom(e.deltaY < 0 ? 1.1 : 0.9);
      }}
      onPointerDown={(e) => {
        zieht.current = { x: e.clientX, y: e.clientY };
        (e.target as Element).setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!zieht.current) return;
        const dx = e.clientX - zieht.current.x;
        const dy = e.clientY - zieht.current.y;
        zieht.current = { x: e.clientX, y: e.clientY };
        setT((s) => ({ ...s, tx: s.tx + dx, ty: s.ty + dy }));
      }}
      onPointerUp={() => (zieht.current = null)}
    >
      <svg width="100%" height="100%" aria-hidden="true" className="cursor-grab active:cursor-grabbing">
        <g transform={`translate(${t.tx},${t.ty}) scale(${t.scale})`}>
          {netz.kanten.map((k, i) => (
            <line
              key={i}
              x1={k.x1}
              y1={k.y1}
              x2={k.x2}
              y2={k.y2}
              stroke="var(--farbe-rahmen)"
              strokeWidth={1.5}
            />
          ))}
          {netz.knoten.map((n) => {
            const haupt = n.tiefe === 0;
            const r = haupt ? 34 : 24;
            return (
              <g
                key={n.id}
                className="cursor-pointer"
                onClick={() => onOeffnen(n.id)}
              >
                <circle
                  cx={n.px}
                  cy={n.py}
                  r={r}
                  fill={haupt ? 'var(--farbe-primaer)' : 'var(--farbe-primaer-soft)'}
                  stroke="var(--farbe-primaer)"
                  strokeWidth={haupt ? 0 : 2}
                />
                {haupt && (
                  <text
                    x={n.px}
                    y={n.py + 5}
                    textAnchor="middle"
                    className="fill-white text-sm font-semibold"
                  >
                    {n.name.charAt(0).toUpperCase()}
                  </text>
                )}
                <text
                  x={n.px}
                  y={n.py + r + 15}
                  textAnchor="middle"
                  className="fill-[var(--farbe-text)] text-xs font-semibold"
                >
                  {n.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Hinweis-Pille unten links */}
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-full border border-rahmen bg-flaeche/90 px-3 py-1 text-xs text-leise shadow-karte">
        Ziehen zum Verschieben · Scrollen zum Zoomen
      </div>
      {/* Zoom-Steuerung unten rechts */}
      <div className="absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-lg border border-rahmen bg-flaeche shadow-karte">
        <button
          type="button"
          onClick={() => zoom(1.2)}
          aria-label="Vergrößern"
          className="grid h-8 w-8 place-items-center text-leise hover:bg-flaeche-3 hover:text-text"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => zoom(0.8)}
          aria-label="Verkleinern"
          className="grid h-8 w-8 place-items-center border-t border-rahmen text-leise hover:bg-flaeche-3 hover:text-text"
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={einpassen}
          aria-label="Zentrieren"
          className="grid h-8 w-8 place-items-center border-t border-rahmen text-leise hover:bg-flaeche-3 hover:text-text"
        >
          <Maximize2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────── Liste-Ansicht

function ListenZeile({
  knoten,
  tiefe,
  onOeffnen,
}: {
  knoten: BaumKnoten;
  tiefe: number;
  onOeffnen: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onOeffnen(knoten.id)}
      className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 py-3.5 pr-3 text-left transition-colors hover:bg-flaeche-2 [--einzug:0.75rem] sm:flex-nowrap sm:[--einzug:1.75rem]"
      // Einrückung je Ebene: in schmalen Fenstern 12 px statt 28 px. Bei drei
      // Ebenen sind das 48 px weniger — genug, damit Typ, Zähler und Pfeil in
      // die umgebrochene zweite Zeile passen, statt eine dritte zu erzwingen.
      style={{ paddingLeft: `calc(1rem + ${tiefe} * var(--einzug))` }}
    >
      {/*
        Marker und Name bilden eine Einheit, die in schmalen Fenstern die ganze
        Zeile bekommt (`w-full`) und den Rest umbrechen lässt. Ohne das ist der
        Name das EINZIGE schrumpfbare Element neben Typ, Zähler und Pfeil — bei
        375 px blieben davon 3 px übrig. Ab `sm` (640 px) reicht die Breite für
        eine Zeile, dort gilt wieder das gewohnte Bild.
      */}
      <span className="flex w-full min-w-0 items-center gap-3 sm:w-auto">
        <Marker haupt={tiefe === 0} />
        <span
          className={`truncate ${tiefe === 0 ? 'font-semibold text-text' : 'font-medium text-text'}`}
        >
          {knoten.name}
        </span>
      </span>
      <span className="shrink-0 text-sm text-leise">
        {/* Das Trennzeichen gehört zur einzeiligen Darstellung; in der
            umgebrochenen Fassung beginnt die zweite Zeile ohne Punkt. */}
        <span aria-hidden="true" className="hidden sm:inline">
          ·{' '}
        </span>
        {DOMAENE_TYP_LABEL[knoten.typ]}
      </span>
      <span className="ml-auto shrink-0 text-sm text-leise">
        <span className="ziffern-tabellarisch font-medium text-text">
          {knoten.anzahlBeschluesse}
        </span>{' '}
        Beschlüsse
      </span>
      <span
        aria-hidden="true"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-primaer bg-primaer-soft text-primaer-softtext"
      >
        <ChevronRight className="h-4 w-4" />
      </span>
    </button>
  );
}

// ───────────────────────────────────────────────────────────────────── Seite

type Ansicht = 'baum' | 'netz' | 'liste';

export function DomaenenKarte() {
  const navigate = useNavigate();
  const [domaenen, setDomaenen] = useState<DomaeneKnotenDTO[] | null>(null);
  const [ansicht, setAnsicht] = useState<Ansicht>('baum');

  useEffect(() => {
    apiFetch<DomaeneKnotenDTO[]>('/api/domaenen')
      .then(setDomaenen)
      .catch(() => setDomaenen([]));
  }, []);

  // Archivierte Domänen erscheinen nur in der Verwaltung, nicht in der Übersicht.
  const wurzeln = useMemo(
    () => (domaenen ? baueBaum(domaenen.filter((d) => !d.archiviert)) : []),
    [domaenen],
  );
  const zeilen = useMemo(() => flach(wurzeln), [wurzeln]);
  const oeffnen = (id: string) => navigate(`/domaenen/${id}`);

  if (domaenen === null) return <Spinner />;

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-start justify-between gap-4">
        <h1 className="font-serif text-3xl font-bold text-text">Domänen</h1>
        <Segmented
          ariaLabel="Ansicht"
          aktiv={ansicht}
          onWechsel={setAnsicht}
          optionen={[
            { wert: 'baum', label: 'Baum' },
            { wert: 'netz', label: 'Netz' },
            { wert: 'liste', label: 'Liste' },
          ]}
        />
      </div>
      <p className="mb-6 text-sm text-leise">
        Alle Domänen der Organisation und ihre Verschachtelung.
      </p>

      {domaenen.length === 0 ? (
        <LeerZustand Icon={Network} titel="Keine Domänen vorhanden" />
      ) : ansicht === 'liste' ? (
        <div className="divide-y divide-rahmen overflow-hidden rounded-2xl border border-rahmen bg-flaeche shadow-karte">
          {zeilen.map(({ k, tiefe }) => (
            <ListenZeile key={k.id} knoten={k} tiefe={tiefe} onOeffnen={oeffnen} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-rahmen bg-flaeche p-5 shadow-karte">
          {/* Kopfzeile der Karte: Legende */}
          <div className="mb-4 flex flex-wrap items-center justify-end gap-4 border-b border-rahmen pb-4 text-sm text-leise">
            <span className="flex items-center gap-1.5">
              <Marker haupt={true} /> Hauptdomäne
            </span>
            <span className="flex items-center gap-1.5">
              <Marker haupt={false} /> Unterdomäne
            </span>
          </div>

          {/* Desktop: interaktive Karte (dekorativ – Nav-Liste liefert die a11y-Struktur). */}
          <div className="hidden lg:block" aria-hidden="true">
            {ansicht === 'baum' ? (
              <div className="overflow-x-auto py-4">
                <ul className="baum w-max min-w-full px-4">
                  {wurzeln.map((w) => (
                    <li key={w.id}>
                      <BaumZelle knoten={w} tiefe={0} onOeffnen={oeffnen} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <NetzAnsicht wurzeln={wurzeln} onOeffnen={oeffnen} />
            )}
          </div>

          {/* Mobil sichtbar; Desktop nur für Screenreader (barrierefreie Struktur). */}
          <nav aria-label="Domänen" className="lg:sr-only">
            <ul>
              {zeilen.map(({ k, tiefe }) => (
                <li key={k.id}>
                  <ListenZeile knoten={k} tiefe={tiefe} onOeffnen={oeffnen} />
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
    </div>
  );
}
