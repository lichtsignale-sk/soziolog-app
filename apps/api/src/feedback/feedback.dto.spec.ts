import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { FEEDBACK_TEXT_MAX, FeedbackDto } from './dto/feedback.dto';

const GUELTIG = {
  text: 'Etwas fehlt.',
  seite: '/domaenen/3f2a-11',
  seitenBezeichnung: 'Domänen-Log',
  rueckfragenErlaubt: false,
};

function fehlerFelder(eingabe: Record<string, unknown>): string[] {
  const dto = plainToInstance(FeedbackDto, eingabe);
  return validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).map(
    (f) => f.property,
  );
}

describe('FeedbackDto', () => {
  it('nimmt ein gewöhnliches Feedback an und trimmt den Text', () => {
    expect(fehlerFelder(GUELTIG)).toEqual([]);
    const dto = plainToInstance(FeedbackDto, { ...GUELTIG, text: '  hallo  ' });
    expect(dto.text).toBe('hallo');
  });

  it.each([
    ['leer', ''],
    ['nur Leerzeichen', '   \n  '],
    ['zu lang', 'x'.repeat(FEEDBACK_TEXT_MAX + 1)],
  ])('lehnt einen Text ab: %s', (_, text) => {
    expect(fehlerFelder({ ...GUELTIG, text })).toContain('text');
  });

  it('nimmt genau die Höchstlänge noch an', () => {
    expect(fehlerFelder({ ...GUELTIG, text: 'x'.repeat(FEEDBACK_TEXT_MAX) })).toEqual([]);
  });

  it.each([
    ['mit Query (Token!)', '/passwort-zuruecksetzen?token=abc'],
    ['mit Fragment', '/konto#x'],
    ['vollständige Adresse', 'https://fremd.test/'],
    ['ohne führenden Schrägstrich', 'konto'],
    ['mit Zeilenumbruch', '/konto\nBcc'],
  ])('lehnt eine Seitenangabe ab: %s', (_, seite) => {
    expect(fehlerFelder({ ...GUELTIG, seite })).toContain('seite');
  });

  it.each(['Domänen (Übersicht)', 'Domänen-Log', 'Sonstige Seite', 'Mein Konto'])(
    'nimmt die Seitenbezeichnung „%s" an',
    (seitenBezeichnung) => {
      expect(fehlerFelder({ ...GUELTIG, seitenBezeichnung })).toEqual([]);
    },
  );

  it.each(['Log\nZeile', '<b>x</b>', 'a@b.test', ''])(
    'lehnt die Seitenbezeichnung %j ab',
    (seitenBezeichnung) => {
      expect(fehlerFelder({ ...GUELTIG, seitenBezeichnung })).toContain('seitenBezeichnung');
    },
  );

  it('verlangt das Häkchen als echten Wahrheitswert', () => {
    expect(fehlerFelder({ ...GUELTIG, rueckfragenErlaubt: 'ja' })).toContain(
      'rueckfragenErlaubt',
    );
  });

  it('lässt keine fremden Felder durch (z. B. eine eigene Antwortadresse)', () => {
    expect(fehlerFelder({ ...GUELTIG, email: 'x@y.test' })).toContain('email');
  });
});
