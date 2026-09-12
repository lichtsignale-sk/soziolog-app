import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthKarte } from './AuthKarte';

/**
 * Die Marke benennt das SYSTEM, nicht das Produkt.
 *
 * Stehen zwei Oberflächen nebeneinander, deren Anmeldeseiten beide nur
 * „SozioLog" tragen, sieht niemand, wo er gerade ist, wenn er den Link aus
 * einem Lesezeichen öffnet. In der angemeldeten Ansicht steht die Angabe in
 * der Seitenleiste — davor fehlte sie, also genau dort, wo die Frage aufkommt.
 */
describe('AuthKarte', () => {
  it('zeigt die Marke unter dem Titel, wenn eine angegeben ist', () => {
    render(
      <AuthKarte titel="SozioLog" marke="Testsystem" untertitel="Anmelden">
        <p>Inhalt</p>
      </AuthKarte>,
    );

    expect(screen.getByRole('heading', { name: 'SozioLog' })).toBeInTheDocument();
    expect(screen.getByText('Testsystem')).toBeInTheDocument();
    expect(screen.getByText('Anmelden')).toBeInTheDocument();
  });

  /** Eine einzelne Oberfläche braucht sie nicht — dort gibt es kein zweites System. */
  it('lässt die Zeile weg, wenn keine Marke angegeben ist', () => {
    render(
      <AuthKarte titel="SozioLog" untertitel="Anmelden">
        <p>Inhalt</p>
      </AuthKarte>,
    );

    expect(screen.queryByText('Testsystem')).not.toBeInTheDocument();
    expect(screen.getByText('Anmelden')).toBeInTheDocument();
  });

  it('steht zwischen Titel und Untertitel', () => {
    const { container } = render(
      <AuthKarte titel="SozioLog" marke="Testsystem" untertitel="Anmelden">
        <p>Inhalt</p>
      </AuthKarte>,
    );

    const texte = Array.from(container.querySelectorAll('h1, p')).map(
      (e) => e.textContent,
    );
    expect(texte.slice(0, 3)).toEqual(['SozioLog', 'Testsystem', 'Anmelden']);
  });
});
