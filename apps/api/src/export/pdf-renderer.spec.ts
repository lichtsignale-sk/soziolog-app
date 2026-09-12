import type {
  VorschlagDTO,
  DomaeneDetailDTO,
  OrganisationExportGruppe,
} from '@soziolog/shared';
import {
  formatiereDatum,
  einzelDefinition,
  domaeneDefinition,
  organisationDefinition,
  rendere,
} from './pdf-renderer';

function beispielVorschlag(): VorschlagDTO {
  return {
    id: 'v1',
    domaeneId: 'd1',
    titel: 'Neue Bewässerung',
    inhalt: 'Wir stellen die Bewässerung auf Tröpfchen um.',
    governanceTyp: 'governance',
    status: 'entschieden',
    datum: '2026-01-15',
    erfasstVonName: 'Lena Brandt',
    bedenken: [{ id: 'b1', inhalt: 'Kostet zunächst mehr.', datum: '2026-01-10' }],
    einwaende: [
      {
        id: 'e1',
        inhalt: 'Wasserdruck reicht nicht.',
        schweregrad: 'schwerwiegend',
        integration: 'Pumpe wird ergänzt.',
        datum: '2026-01-12',
      },
    ],
    beschluss: {
      id: 'be1',
      inhalt: 'Umstellung bis Mai beschlossen.',
      notiz: null,
      befristung: 'befristet',
      ueberpruefungsdatum: '2026-12-31',
      gueltigkeitStatus: 'gueltig',
      gueltigAb: '2026-01-15',
      gueltigBis: null,
      datum: '2026-01-15',
      erfasstVonLabel: 'Logbuchführung · Anbaukreis',
      ersetztBeschlussId: null,
      ersetztDurch: null,
    },
    neufassungVon: null,
  };
}

function beispielDomaene(): DomaeneDetailDTO {
  return {
    id: 'd1',
    name: 'Anbaukreis',
    ziel: 'Den Anbau planen.',
    tasks: ['Aussaat', 'Ernte'],
    typ: 'dauerdomaene',
    elternDomaeneId: null,
    aktiv: true,
    archiviert: false,
    anzahlBeschluesse: 1,
    anzahlOffeneEinwaende: 0,
    elternDomaeneName: null,
  };
}

describe('formatiereDatum', () => {
  it('wandelt YYYY-MM-DD in TT.MM.JJJJ', () => {
    expect(formatiereDatum('2026-08-29')).toBe('29.08.2026');
  });
});

describe('einzelDefinition', () => {
  it('enthält Titel, Bedenken, Einwand-Integration und das Beschluss-Rollen-Label', () => {
    const def = einzelDefinition(beispielVorschlag(), 'Anbaukreis', 'Solawi Rheintal');
    const text = JSON.stringify(def.content);
    expect(text).toContain('Neue Bewässerung');
    expect(text).toContain('Kostet zunächst mehr.');
    expect(text).toContain('Pumpe wird ergänzt.');
    expect(text).toContain('Logbuchführung · Anbaukreis');
    // Anonymität: der Beschluss zeigt nur das Rollen-Label, keinen Klarnamen.
    expect(text).not.toContain('Gefasst durch Lena Brandt');
  });

  it('rendert ein gültiges PDF', async () => {
    const buffer = await rendere(einzelDefinition(beispielVorschlag(), 'Anbaukreis', 'Solawi Rheintal'));
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });
});

describe('domaeneDefinition & organisationDefinition', () => {
  it('beginnt im Domänen-Export jeden Vorgang auf einer neuen Seite', () => {
    const def = domaeneDefinition(beispielDomaene(), [beispielVorschlag(), beispielVorschlag()], 'Solawi Rheintal');
    expect(JSON.stringify(def.content)).toContain('"pageBreak":"before"');
  });

  it('zeigt den Organisationsnamen in der Fußzeile', () => {
    const def = einzelDefinition(beispielVorschlag(), 'Anbaukreis', 'Solawi Rheintal');
    const footer = (def.footer as (c: number, p: number) => unknown)(1, 3);
    expect(JSON.stringify(footer)).toContain('Solawi Rheintal');
  });

  it('rendert Domänen- und Org-PDF als gültige PDFs', async () => {
    const dom = await rendere(domaeneDefinition(beispielDomaene(), [beispielVorschlag()], 'Solawi Rheintal'));
    expect(dom.subarray(0, 5).toString()).toBe('%PDF-');

    const gruppen: OrganisationExportGruppe[] = [
      { domaene: beispielDomaene(), vorschlaege: [beispielVorschlag()] },
    ];
    const org = await rendere(organisationDefinition('Solawi Rheintal', 'Lena Brandt', gruppen));
    expect(org.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
