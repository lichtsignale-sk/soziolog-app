import { describe, it, expect } from 'vitest';
import { istKorrigierbar, KORRIGIERBARE_FELDER } from './korrektur';

describe('istKorrigierbar() – Feld-Whitelist', () => {
  it('erlaubt die korrigierbaren Felder je Zieltyp', () => {
    expect(istKorrigierbar('vorschlag', 'titel')).toBe(true);
    expect(istKorrigierbar('vorschlag', 'inhalt')).toBe(true);
    expect(istKorrigierbar('bedenken', 'inhalt')).toBe(true);
    expect(istKorrigierbar('einwand', 'inhalt')).toBe(true);
    expect(istKorrigierbar('einwand', 'integration')).toBe(true);
    expect(istKorrigierbar('beschluss', 'inhalt')).toBe(true);
    expect(istKorrigierbar('beschluss', 'notiz')).toBe(true);
  });

  it('lehnt Zeit-/Status-/Gültigkeits-/Governance-/Schweregrad-Felder ab', () => {
    expect(istKorrigierbar('vorschlag', 'status')).toBe(false);
    expect(istKorrigierbar('vorschlag', 'datum')).toBe(false);
    expect(istKorrigierbar('vorschlag', 'governanceTyp')).toBe(false);
    expect(istKorrigierbar('einwand', 'schweregrad')).toBe(false);
    expect(istKorrigierbar('beschluss', 'gueltigBis')).toBe(false);
    // befristung wird NICHT direkt korrigiert – die Änderung läuft über das Feld
    // ueberpruefungsdatum (leer ⇒ unbefristet, Datum ⇒ befristet).
    expect(istKorrigierbar('beschluss', 'befristung')).toBe(false);
    expect(istKorrigierbar('beschluss', 'gueltigkeitStatus')).toBe(false);
  });

  it('erlaubt das Überprüfungsdatum als Befristungs-Korrektur', () => {
    expect(istKorrigierbar('beschluss', 'ueberpruefungsdatum')).toBe(true);
  });

  it('lehnt ein Feld ab, das es beim Zieltyp gar nicht gibt', () => {
    expect(istKorrigierbar('bedenken', 'notiz')).toBe(false);
    expect(istKorrigierbar('vorschlag', 'integration')).toBe(false);
  });

  it('deckt genau die dokumentierten Felder ab', () => {
    expect(KORRIGIERBARE_FELDER.vorschlag).toEqual(['titel', 'inhalt']);
    expect(KORRIGIERBARE_FELDER.bedenken).toEqual(['inhalt']);
    expect(KORRIGIERBARE_FELDER.einwand).toEqual(['inhalt', 'integration']);
    expect(KORRIGIERBARE_FELDER.beschluss).toEqual([
      'inhalt',
      'notiz',
      'ueberpruefungsdatum',
    ]);
  });
});
