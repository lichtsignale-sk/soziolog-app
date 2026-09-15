import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Dialog } from './Dialog';

/**
 * DER FEHLER, DEN DIESE TESTS FESTHALTEN: Nach jedem Buchstaben in einem
 * Eingabefeld sprang der Cursor auf das Schließen-X.
 *
 * Ursache war `onSchliessen` in der Abhängigkeitsliste der Fokusfalle. Fast
 * alle Aufrufer übergeben dort eine Pfeilfunktion — bei jedem Rendern eine
 * neue Identität. Der Effekt lief also nach jedem Tastendruck erneut und
 * griff nach dem ersten bedienbaren Element.
 *
 * Der Test bildet genau das nach: ein Dialog, dessen `onSchliessen` bei jedem
 * Rendern neu entsteht, und ein Eingabefeld mit eigenem Zustand.
 */
function DialogMitFeld({ autoFokus = false }: { autoFokus?: boolean }) {
  const [wert, setWert] = useState('');
  return (
    <Dialog
      offen
      titel="Organisation anlegen"
      // BEWUSST instabil — genau das tun 52 der 67 Aufrufstellen.
      onSchliessen={() => undefined}
    >
      <input
        aria-label="Name"
        autoFocus={autoFokus}
        value={wert}
        onChange={(e) => setWert(e.target.value)}
      />
    </Dialog>
  );
}

describe('Dialog — Fokus beim Tippen', () => {
  it('lässt den Fokus im Eingabefeld, Buchstabe für Buchstabe', () => {
    render(<DialogMitFeld />);
    const feld = screen.getByLabelText('Name') as HTMLInputElement;
    feld.focus();

    for (const zeichen of ['M', 'Mu', 'Mus', 'Must']) {
      fireEvent.change(feld, { target: { value: zeichen } });
      expect(document.activeElement).toBe(feld);
    }
    expect(feld.value).toBe('Must');
  });

  it('reisst den Fokus nicht auf das Schließen-X', () => {
    render(<DialogMitFeld />);
    const feld = screen.getByLabelText('Name');
    const schliessen = screen.getByRole('button', { name: /schlie/i });
    feld.focus();

    fireEvent.change(feld, { target: { value: 'A' } });

    expect(document.activeElement).not.toBe(schliessen);
    expect(document.activeElement).toBe(feld);
  });

  it('respektiert autoFocus im Inhalt, statt das X zu greifen', () => {
    render(<DialogMitFeld autoFokus />);
    expect(document.activeElement).toBe(screen.getByLabelText('Name'));
  });

  it('fokussiert ohne autoFocus das erste bedienbare Element', () => {
    render(
      <Dialog offen titel="Ohne Feld" onSchliessen={() => undefined}>
        <p>Nur Text</p>
      </Dialog>,
    );
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: /schlie/i }),
    );
  });

  it('Escape ruft die AKTUELLE Schliessen-Funktion, nicht eine veraltete', () => {
    const ersteRufe: string[] = [];
    function Huelle() {
      const [zahl, setZahl] = useState(0);
      return (
        <Dialog
          offen
          titel="Test"
          onSchliessen={() => ersteRufe.push(`stand-${zahl}`)}
        >
          <button onClick={() => setZahl((z) => z + 1)}>Hochzaehlen</button>
        </Dialog>
      );
    }
    render(<Huelle />);

    fireEvent.click(screen.getByRole('button', { name: 'Hochzaehlen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hochzaehlen' }));
    fireEvent.keyDown(document, { key: 'Escape' });

    // Ohne die Ref haette hier der Stand vom ersten Rendern gestanden.
    expect(ersteRufe).toEqual(['stand-2']);
  });

  it('gibt den Fokus beim Schliessen an das Element davor zurueck', () => {
    function Umschalter() {
      const [offen, setOffen] = useState(false);
      return (
        <>
          <button onClick={() => setOffen(true)}>Oeffnen</button>
          <Dialog offen={offen} titel="Test" onSchliessen={() => setOffen(false)}>
            <p>Inhalt</p>
          </Dialog>
        </>
      );
    }
    render(<Umschalter />);
    const oeffnen = screen.getByRole('button', { name: 'Oeffnen' });
    oeffnen.focus();
    fireEvent.click(oeffnen);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(document.activeElement).toBe(oeffnen);
  });

  /**
   * Regressionstest: Mit `autoFocus` im Inhalt merkte sich der Dialog das
   * FELD als „vorher fokussiert" (autoFocus greift vor dem Effekt) und gab
   * den Fokus beim Schliessen an ein entferntes Element — er fiel auf <body>.
   */
  it('gibt den Fokus auch mit autoFocus im Inhalt an den Ausloeser zurueck', () => {
    function Umschalter() {
      const [offen, setOffen] = useState(false);
      return (
        <>
          <button onClick={() => setOffen(true)}>Oeffnen</button>
          <Dialog offen={offen} titel="Test" onSchliessen={() => setOffen(false)}>
            <textarea aria-label="Text" autoFocus />
          </Dialog>
        </>
      );
    }
    render(<Umschalter />);
    const oeffnen = screen.getByRole('button', { name: 'Oeffnen' });
    oeffnen.focus();
    fireEvent.click(oeffnen);
    expect(document.activeElement).toBe(screen.getByLabelText('Text'));

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(document.activeElement).toBe(oeffnen);
  });

  it('greift nicht ins Leere, wenn der Ausloeser inzwischen verschwunden ist', () => {
    function Umschalter() {
      const [offen, setOffen] = useState(false);
      return (
        <>
          {!offen && <button onClick={() => setOffen(true)}>Oeffnen</button>}
          <button>Bleibt</button>
          <Dialog offen={offen} titel="Test" onSchliessen={() => setOffen(false)}>
            <p>Inhalt</p>
          </Dialog>
        </>
      );
    }
    render(<Umschalter />);
    const oeffnen = screen.getByRole('button', { name: 'Oeffnen' });
    oeffnen.focus();
    fireEvent.click(oeffnen);

    expect(() => fireEvent.keyDown(document, { key: 'Escape' })).not.toThrow();
    expect(oeffnen.isConnected).toBe(false);
    expect(document.activeElement).not.toBe(oeffnen);
  });
});
