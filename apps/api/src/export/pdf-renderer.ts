/**
 * Erzeugt PDF-Dokumente für den Export – reine Funktionen (kein Nest), damit sie
 * gut unit-testbar sind. Ein gemeinsamer Baustein `vorschlagBlock` bildet einen
 * Vorgang (Vorschlag → Bedenken/Einwände → Beschluss) ab und wird von allen drei
 * Ebenen (Einzel, Domäne, Organisation) wiederverwendet.
 *
 * pdfmake wird serverseitig genutzt (pure-JS, kein Chromium). Fonts (Roboto)
 * werden einmalig als Dateipfade aus dem pdfmake-Paket registriert.
 */
import * as path from 'path';
import * as pdfMake from 'pdfmake';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import {
  GOVERNANCE_LABEL,
  VORSCHLAG_STATUS_LABEL,
  GUELTIGKEIT_STATUS_LABEL,
  BEFRISTUNG_LABEL,
  SCHWEREGRAD_LABEL,
  DOMAENE_TYP_LABEL,
} from '@soziolog/shared';
import type {
  VorschlagDTO,
  BeschlussDTO,
  DomaeneDetailDTO,
} from '@soziolog/shared';
import type { OrganisationExportGruppe } from '@soziolog/shared';

// ------------------------------------------------------------------ Design
const FARBE = {
  primaer: '#3a7d6b',
  text: '#1e2621',
  leise: '#54605a',
  rahmen: '#e3e7e1',
  beschlussBg: '#e6f0ec',
  bedenkenBg: '#f4f1e8',
  einwandBg: '#f5eae9',
} as const;

// ---------------------------------------------------------------- Font-Init
let fontsBereit = false;
function initFonts(): void {
  if (fontsBereit) return;
  const dir = path.join(path.dirname(require.resolve('pdfmake/package.json')), 'build', 'fonts', 'Roboto');
  pdfMake.setFonts({
    Roboto: {
      normal: path.join(dir, 'Roboto-Regular.ttf'),
      bold: path.join(dir, 'Roboto-Medium.ttf'),
      italics: path.join(dir, 'Roboto-Italic.ttf'),
      bolditalics: path.join(dir, 'Roboto-MediumItalic.ttf'),
    },
  });
  // Sicherheit: keine externen URLs; lokaler Zugriff nur aufs Font-Verzeichnis.
  pdfMake.setUrlAccessPolicy(() => false);
  pdfMake.setLocalAccessPolicy((p) => p.startsWith(dir));
  fontsBereit = true;
}

// ------------------------------------------------------------------ Helfer
/** YYYY-MM-DD → TT.MM.JJJJ (reines Kalenderdatum, keine Uhrzeit). */
export function formatiereDatum(iso: string): string {
  const [j, m, t] = iso.split('-');
  return `${t}.${m}.${j}`;
}

function absatz(text: string, extra: Record<string, unknown> = {}): Content {
  return { text, margin: [0, 0, 0, 4], ...extra } as Content;
}

/** Beschluss-Kasten (grün hinterlegt) mit allen Gültigkeits-/Befristungsangaben. */
function beschlussBox(b: BeschlussDTO): Content {
  const zeilen: Content[] = [
    { text: 'Beschluss', bold: true, color: FARBE.primaer, margin: [0, 0, 0, 4] },
    { text: b.inhalt, margin: [0, 0, 0, 6] },
  ];
  if (b.notiz) {
    zeilen.push({ text: `Notiz: ${b.notiz}`, italics: true, color: FARBE.leise, margin: [0, 0, 0, 6] });
  }
  const meta: string[] = [
    `Gefasst durch ${b.erfasstVonLabel} am ${formatiereDatum(b.datum)}`,
    `Status: ${GUELTIGKEIT_STATUS_LABEL[b.gueltigkeitStatus]}`,
    `${BEFRISTUNG_LABEL[b.befristung]}${b.ueberpruefungsdatum ? ` · Überprüfung am ${formatiereDatum(b.ueberpruefungsdatum)}` : ''}`,
    `Gültig ab ${formatiereDatum(b.gueltigAb)}${b.gueltigBis ? ` bis ${formatiereDatum(b.gueltigBis)}` : ''}`,
  ];
  if (b.ersetztDurch) {
    meta.push(`Abgelöst durch: „${b.ersetztDurch.titel}"`);
  }
  zeilen.push({
    text: meta.join('\n'),
    fontSize: 9,
    color: FARBE.leise,
    lineHeight: 1.25,
  });
  return {
    table: { widths: ['*'], body: [[{ stack: zeilen, margin: [10, 8, 10, 8] }]] },
    layout: {
      fillColor: () => FARBE.beschlussBg,
      hLineWidth: () => 0,
      vLineWidth: () => 0,
    },
    margin: [0, 4, 0, 4],
  };
}

/**
 * Ein einzelner Vorgang als Block (in allen drei Export-Ebenen genutzt).
 * `seitenumbruch`: beginnt den Vorgang auf einer neuen Seite (übersichtlicher im
 * Domänen-/Org-Export) und lässt den Trenner am Ende weg.
 */
export function vorschlagBlock(
  v: VorschlagDTO,
  opts: { seitenumbruch?: boolean } = {},
): Content[] {
  const teile: Content[] = [];

  teile.push({
    text: v.titel,
    style: 'vorgangTitel',
    ...(opts.seitenumbruch ? { pageBreak: 'before' as const } : {}),
  });
  teile.push({
    text: `${GOVERNANCE_LABEL[v.governanceTyp]} · ${VORSCHLAG_STATUS_LABEL[v.status]} · Erfasst von ${v.erfasstVonName} am ${formatiereDatum(v.datum)}`,
    fontSize: 9,
    color: FARBE.leise,
    margin: [0, 0, 0, 6],
  });
  if (v.neufassungVon) {
    teile.push(absatz(`Neufassung von „${v.neufassungVon.titel}" – löst den bisherigen Beschluss ab.`, {
      italics: true,
      color: FARBE.leise,
    }));
  }
  teile.push({ text: v.inhalt, margin: [0, 0, 0, 6] });

  if (v.bedenken.length > 0) {
    teile.push({ text: `Bedenken (${v.bedenken.length}, anonym)`, bold: true, fontSize: 10, margin: [0, 2, 0, 3] });
    for (const b of v.bedenken) {
      teile.push({
        table: { widths: ['*'], body: [[{ stack: [
          { text: b.inhalt },
          { text: formatiereDatum(b.datum), fontSize: 8, color: FARBE.leise, margin: [0, 2, 0, 0] },
        ], margin: [10, 6, 10, 6] }]] },
        layout: { fillColor: () => FARBE.bedenkenBg, hLineWidth: () => 0, vLineWidth: () => 0 },
        margin: [0, 0, 0, 4],
      });
    }
  }

  if (v.einwaende.length > 0) {
    teile.push({ text: `Einwände (${v.einwaende.length}, anonym)`, bold: true, fontSize: 10, margin: [0, 2, 0, 3] });
    for (const e of v.einwaende) {
      const stack: Content[] = [
        { text: `Schweregrad: ${SCHWEREGRAD_LABEL[e.schweregrad]}`, fontSize: 9, color: FARBE.leise },
        { text: e.inhalt, margin: [0, 2, 0, 0] },
      ];
      if (e.integration) {
        stack.push({ text: `Integration: ${e.integration}`, italics: true, margin: [0, 3, 0, 0] });
      }
      stack.push({ text: formatiereDatum(e.datum), fontSize: 8, color: FARBE.leise, margin: [0, 2, 0, 0] });
      teile.push({
        table: { widths: ['*'], body: [[{ stack, margin: [10, 6, 10, 6] }]] },
        layout: { fillColor: () => FARBE.einwandBg, hLineWidth: () => 0, vLineWidth: () => 0 },
        margin: [0, 0, 0, 4],
      });
    }
  }

  if (v.beschluss) {
    teile.push(beschlussBox(v.beschluss));
  }

  // Trenner nur, wenn die Vorgänge auf derselben Seite fließen; bei
  // Seitenumbruch je Vorgang ist er überflüssig.
  if (!opts.seitenumbruch) {
    teile.push({
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: FARBE.rahmen }],
      margin: [0, 8, 0, 12],
    });
  }
  return teile;
}

// -------------------------------------------------------- Dokument-Rahmen
function basisDefinition(
  dokumentTitel: string,
  organisationName: string,
  inhalt: Content[],
): TDocumentDefinitions {
  const heute = formatiereDatum(new Date().toISOString().slice(0, 10));
  return {
    info: { title: dokumentTitel, author: 'SozioLog', subject: organisationName },
    pageSize: 'A4',
    pageMargins: [40, 54, 40, 48],
    defaultStyle: { font: 'Roboto', fontSize: 10, color: FARBE.text, lineHeight: 1.3 },
    styles: {
      dokTitel: { fontSize: 20, bold: true, color: FARBE.primaer, margin: [0, 0, 0, 2] },
      domaeneTitel: { fontSize: 15, bold: true, color: FARBE.text, margin: [0, 6, 0, 4] },
      vorgangTitel: { fontSize: 13, bold: true, color: FARBE.text, margin: [0, 4, 0, 2] },
      klein: { fontSize: 9, color: FARBE.leise },
    },
    header: (currentPage: number) =>
      currentPage === 1
        ? undefined
        : { text: 'SozioLog', color: FARBE.primaer, bold: true, fontSize: 9, margin: [40, 24, 40, 0] },
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: `SozioLog · ${organisationName}`, fontSize: 8, color: FARBE.leise, margin: [40, 0, 0, 0] },
        { text: `Seite ${currentPage} von ${pageCount} · Stand ${heute}`, alignment: 'right', fontSize: 8, color: FARBE.leise, margin: [0, 0, 40, 0] },
      ],
    }),
    content: inhalt,
  };
}

// ----------------------------------------------------------- Dokumente je Ebene
export function einzelDefinition(
  v: VorschlagDTO,
  domaeneName: string,
  organisationName: string,
): TDocumentDefinitions {
  return basisDefinition(`Beschluss – ${v.titel}`, organisationName, [
    { text: 'SozioLog – Beschluss', style: 'dokTitel' },
    { text: `${organisationName} · Domäne: ${domaeneName}`, style: 'klein', margin: [0, 0, 0, 12] },
    ...vorschlagBlock(v),
  ]);
}

export function domaeneDefinition(
  domaene: DomaeneDetailDTO,
  vorschlaege: VorschlagDTO[],
  organisationName: string,
): TDocumentDefinitions {
  const kopf: Content[] = [
    { text: 'SozioLog – Domänen-Export', style: 'dokTitel' },
    { text: organisationName, style: 'klein', margin: [0, 0, 0, 8] },
    { text: domaene.name, style: 'domaeneTitel' },
    {
      text: `${DOMAENE_TYP_LABEL[domaene.typ]}${domaene.elternDomaeneName ? ` · Unterdomäne von ${domaene.elternDomaeneName}` : ''} · ${domaene.anzahlBeschluesse} Beschlüsse`,
      style: 'klein',
      margin: [0, 0, 0, 8],
    },
    { text: 'Ziel', bold: true, fontSize: 10, margin: [0, 4, 0, 2] },
    { text: domaene.ziel, margin: [0, 0, 0, 6] },
  ];
  if (domaene.tasks.length > 0) {
    kopf.push({ text: 'Domänenaufgaben', bold: true, fontSize: 10, margin: [0, 2, 0, 2] });
    kopf.push({ ul: domaene.tasks, margin: [0, 0, 0, 12] });
  }
  const koerper: Content[] =
    vorschlaege.length === 0
      ? [{ text: 'Noch keine Vorschläge oder Beschlüsse in dieser Domäne.', italics: true, color: FARBE.leise }]
      : vorschlaege.flatMap((v) => vorschlagBlock(v, { seitenumbruch: true }));
  return basisDefinition(`Domäne – ${domaene.name}`, organisationName, [...kopf, ...koerper]);
}

export function organisationDefinition(
  organisationName: string,
  erstelltVon: string,
  gruppen: OrganisationExportGruppe[],
): TDocumentDefinitions {
  const heute = formatiereDatum(new Date().toISOString().slice(0, 10));
  const anzVorschlaege = gruppen.reduce((s, g) => s + g.vorschlaege.length, 0);
  const anzBeschluesse = gruppen.reduce((s, g) => s + g.vorschlaege.filter((v) => v.beschluss).length, 0);

  // Deckblatt
  const inhalt: Content[] = [
    { text: 'SozioLog', style: 'dokTitel', margin: [0, 120, 0, 0] },
    { text: 'Gesamt-Export der Organisation', fontSize: 15, bold: true, margin: [0, 4, 0, 24] },
    { text: organisationName, fontSize: 22, bold: true, color: FARBE.text, margin: [0, 0, 0, 24] },
    {
      text: [
        `Domänen: ${gruppen.length}\n`,
        `Vorschläge: ${anzVorschlaege}\n`,
        `Beschlüsse: ${anzBeschluesse}\n\n`,
        `Erstellt am ${heute} von ${erstelltVon}`,
      ],
      fontSize: 11,
      color: FARBE.leise,
      lineHeight: 1.5,
    },
  ];

  // Je Domäne eine neue Seite
  for (const g of gruppen) {
    inhalt.push({ text: g.domaene.name, style: 'domaeneTitel', pageBreak: 'before' });
    inhalt.push({
      text: `${DOMAENE_TYP_LABEL[g.domaene.typ]}${g.domaene.elternDomaeneName ? ` · Unterdomäne von ${g.domaene.elternDomaeneName}` : ''} · ${g.vorschlaege.length} Vorgänge`,
      style: 'klein',
      margin: [0, 0, 0, 4],
    });
    if (g.domaene.ziel) {
      inhalt.push({ text: g.domaene.ziel, italics: true, color: FARBE.leise, margin: [0, 0, 0, 12] });
    }
    if (g.vorschlaege.length === 0) {
      inhalt.push({ text: 'Keine Vorgänge.', italics: true, color: FARBE.leise });
    } else {
      inhalt.push(...g.vorschlaege.flatMap((v) => vorschlagBlock(v, { seitenumbruch: true })));
    }
  }

  return basisDefinition(`Organisation – ${organisationName}`, organisationName, inhalt);
}

/** Rendert eine Dokumentdefinition zu einem PDF-Buffer. */
export async function rendere(definition: TDocumentDefinitions): Promise<Buffer> {
  initFonts();
  return pdfMake.createPdf(definition).getBuffer();
}
