import { Logger } from '@nestjs/common';
import { MailService } from './mail.service';

/**
 * Regressionstests: Ohne SMTP faellt nodemailer auf jsonTransport
 * zurueck. Der bisherige Zweig protokollierte dabei `devHinweis` — bei
 * Passwort-Reset und Einladung also den vollstaendigen Link samt Token. Auf
 * einer Produktivinstanz ohne SMTP stand damit ein Kontouebernahme-Ausweis
 * dauerhaft im Container-Log.
 */
function baueDienst(nodeEnv: string) {
  const config = {
    get: jest.fn((schluessel: string, fallback?: string) => {
      if (schluessel === 'NODE_ENV') return nodeEnv;
      if (schluessel === 'APP_URL') return 'https://soziolog.example.org';
      if (schluessel === 'SMTP_HOST') return undefined; // kein Postausgang
      if (schluessel === 'SMTP_FROM') return 'SozioLog <noreply@example.org>';
      return fallback;
    }),
  };
  const konfig = { holeSmtp: jest.fn().mockResolvedValue(null) };
  return new MailService(config as never, konfig as never);
}

const RESET_URL = 'https://soziolog.example.org/passwort-zuruecksetzen?token=GEHEIM123';

describe('Mailversand ohne SMTP', () => {
  let logZeilen: string[];

  beforeEach(() => {
    logZeilen = [];
    jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation((m: unknown) => void logZeilen.push(String(m)));
    jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation((m: unknown) => void logZeilen.push(String(m)));
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it('schreibt den Reset-Token NICHT ins Log einer Produktivinstanz', async () => {
    await baueDienst('production').sendePasswortReset('a@demo.test', RESET_URL);

    const alles = logZeilen.join('\n');
    expect(alles).not.toContain('GEHEIM123');
    expect(alles).not.toContain('passwort-zuruecksetzen?token=');
  });

  it('warnt in Produktion stattdessen, dass gar nichts versendet wurde', async () => {
    await baueDienst('production').sendePasswortReset('a@demo.test', RESET_URL);

    const alles = logZeilen.join('\n');
    expect(alles).toMatch(/Kein SMTP-Server/i);
    expect(alles).toMatch(/NICHT.*versendet/i);
  });

  it('zeigt den Link in der Entwicklung weiterhin — anders kaeme man nicht heran', async () => {
    await baueDienst('development').sendePasswortReset('a@demo.test', RESET_URL);

    expect(logZeilen.join('\n')).toContain(RESET_URL);
  });
});
