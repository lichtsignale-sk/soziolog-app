import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { CheckCircle2, Landmark } from 'lucide-react';
import { FilterChips } from './FilterChips';
import { GefahrKarte } from './GefahrKarte';
import { IconKnopf } from './IconKnopf';
import { Kennzahlkachel } from './Kennzahlkachel';
import { NoticeBar } from './NoticeBar';
import { StatusPille } from './StatusPille';
import { Tabelle } from './Tabelle';
import { ZeilenLink } from './ZeilenLink';

/**
 * Die Bausteine des Verwaltungs-Redesigns.
 *
 * Geprüft wird nicht, ob sie „richtig aussehen" — das entscheidet der
 * Screenshot-Vergleich. Geprüft wird, was eine Klasse allein nicht hergibt:
 * dass die Bedeutung ankommt (Wort statt nur Farbe), dass jeder Icon-Knopf
 * eine Beschriftung trägt, und dass die Erweiterung der `Tabelle` für
 * bestehende Aufrufer folgenlos bleibt.
 */

describe('StatusPille — Farbe ist nie das alleinige Signal', () => {
  it('zeigt das Wort, nicht nur die Farbe', () => {
    render(<StatusPille art="bestaetigt">Zahlend</StatusPille>);
    expect(screen.getByText('Zahlend')).toBeInTheDocument();
  });

  it('hält den Punkt vor der Vorlesestimme verborgen', () => {
    // Ein Punkt ohne Bedeutung, der vorgelesen wird, ist Lärm. Die Aussage
    // steht im Wort daneben.
    const { container } = render(
      <StatusPille art="achtung" mitPunkt>
        Ruhend
      </StatusPille>,
    );
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
  });

  it('trägt einen Zusatz in derselben Pille, nicht in einer zweiten', () => {
    // „Pilot" mit „läuft" darunter ist EINE Aussage. Zwei Pillen wären zwei.
    render(
      <StatusPille art="hinweis" zusatz="läuft">
        Pilot
      </StatusPille>,
    );
    const pille = screen.getByText('Pilot').closest('span');
    expect(within(pille!).getByText('läuft')).toBeInTheDocument();
  });
});

describe('IconKnopf — ohne Beschriftung nicht baubar', () => {
  it('setzt aria-label UND title aus derselben Angabe', () => {
    render(<IconKnopf Icon={CheckCircle2} beschriftung="Als bezahlt markieren" />);
    const knopf = screen.getByRole('button', { name: 'Als bezahlt markieren' });
    expect(knopf).toHaveAttribute('title', 'Als bezahlt markieren');
  });

  it('versteckt das Symbol vor der Vorlesestimme', () => {
    // Sonst hört man den Namen des Symbols zusätzlich zur Beschriftung.
    const { container } = render(<IconKnopf Icon={CheckCircle2} beschriftung="Ansehen" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('FilterChips — Schalter, keine Registerkarten', () => {
  const CHIPS = [
    { wert: 'alle' as const, label: 'Alle', anzahl: 94 },
    { wert: 'anfrage' as const, label: 'Anfrage', anzahl: 12 },
    { wert: 'ueberfaellig' as const, label: 'Überfällig', anzahl: 0 },
  ];

  it('meldet den gewählten Chip als gedrückt', () => {
    render(
      <FilterChips chips={CHIPS} aktiv="anfrage" onWaehle={() => {}} beschriftung="Status" />,
    );
    expect(screen.getByRole('button', { name: /Anfrage/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /^Alle/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('BLENDET EINEN CHIP MIT NULL NICHT AUS', () => {
    // „Überfällig 0" ist eine gute Nachricht — und eine Leiste, deren
    // Einträge wandern, lässt sich nicht blind bedienen.
    render(<FilterChips chips={CHIPS} aktiv="alle" onWaehle={() => {}} beschriftung="Status" />);
    expect(screen.getByRole('button', { name: /Überfällig/ })).toBeInTheDocument();
  });

  it('gibt den gewählten Wert weiter', () => {
    const gewaehlt = vi.fn();
    render(<FilterChips chips={CHIPS} aktiv="alle" onWaehle={gewaehlt} beschriftung="Status" />);
    fireEvent.click(screen.getByRole('button', { name: /Anfrage/ }));
    expect(gewaehlt).toHaveBeenCalledWith('anfrage');
  });
});

describe('Kennzahlkachel — jede Zahl führt irgendwohin', () => {
  it('ist ein Knopf und meldet den Klick', () => {
    const geklickt = vi.fn();
    render(
      <Kennzahlkachel
        Icon={Landmark}
        zahl="1.860,00 €"
        label="Offene Beträge"
        onKlick={geklickt}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Offene Beträge/ }));
    expect(geklickt).toHaveBeenCalledOnce();
  });
});

describe('ZeilenLink — führt hin, löst nichts aus', () => {
  it('bleibt ein echter Verweis, damit Mittelklick funktioniert', () => {
    render(<ZeilenLink href="/organisationen/1">Erledigen</ZeilenLink>);
    expect(screen.getByRole('link', { name: /Erledigen/ })).toHaveAttribute(
      'href',
      '/organisationen/1',
    );
  });
});

describe('NoticeBar und GefahrKarte', () => {
  it('nimmt einen Knopf neben den Satz', () => {
    render(
      <NoticeBar art="bestaetigt" aktion={<button type="button">Einwilligungen</button>}>
        Versand nur an bestätigte Einwilligungen.
      </NoticeBar>,
    );
    expect(screen.getByRole('button', { name: 'Einwilligungen' })).toBeInTheDocument();
  });

  it('GefahrKarte trägt Titel, eine Zeile und den Knopf', () => {
    render(
      <GefahrKarte titel="Kontaktdaten löschen" aktion={<button type="button">Löschen …</button>}>
        Personenbezug entfernen · Datensatz und Verlauf bleiben · endgültig
      </GefahrKarte>,
    );
    expect(screen.getByRole('heading', { name: 'Kontaktdaten löschen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Löschen …' })).toBeInTheDocument();
  });
});

describe('Tabelle — die Erweiterung ist rückwirkungsfrei', () => {
  function baue(zusatz: Record<string, unknown>) {
    const { container } = render(
      <Tabelle spalten={['A', 'B']} beschriftung="p" {...zusatz}>
        <tr>
          <td>1</td>
          <td>2</td>
        </tr>
      </Tabelle>,
    );
    return container;
  }

  it('sieht ohne neue Angaben aus wie zuvor', () => {
    // Der Bestand ruft die Tabelle ohne `variante` auf. Änderte sich die
    // Vorgabe, zöge das 47 Dateien in apps/web mit.
    const ohne = baue({});
    const kopf = ohne.querySelector('thead');
    expect(kopf?.className).toContain('bg-flaeche-3');
    expect(kopf?.className).not.toContain('bg-flaeche-4');
    expect(ohne.querySelector('table')?.className).not.toContain('ziffern-tabellarisch');
  });

  it('schaltet erst mit variante="liste" auf den dichten Stil um', () => {
    const mit = baue({ variante: 'liste' });
    expect(mit.querySelector('thead')?.className).toContain('bg-flaeche-4');
    expect(mit.querySelector('tbody')?.className).toContain('divide-rahmen-leise');
    expect(mit.querySelector('table')?.className).toContain('ziffern-tabellarisch');
  });

  it('rückt nur auf Verlangen die letzte Spalte nach rechts', () => {
    expect(baue({}).querySelector('table')?.className).not.toContain('last-child');
    expect(baue({ aktionsspalte: true }).querySelector('table')?.className).toContain(
      'td:last-child',
    );
  });
});
