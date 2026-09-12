import { NotFoundException } from '@nestjs/common';
import { AnfrageService } from './anfrage.service';

function baue(env: Record<string, string> = {}) {
  const mail = {
    sendeDemoZugang: jest.fn().mockResolvedValue(undefined),
    sendeInterneAnfrage: jest.fn().mockResolvedValue(undefined),
    sendePilotBestaetigung: jest.fn().mockResolvedValue(undefined),
  };
  const config = { get: (k: string, d?: string) => env[k] ?? d };
  const service = new AnfrageService(mail as never, config as never);
  return { service, mail };
}

const EMPF = { ANFRAGE_EMPFAENGER: 'team@example.org' };

describe('AnfrageService.demo', () => {
  it('schickt Zugangsdaten an die Adresse und benachrichtigt das Team', async () => {
    const { service, mail } = baue(EMPF);
    await service.demo({ email: 'gast@example.org', name: 'Gast' });
    expect(mail.sendeDemoZugang).toHaveBeenCalledWith('gast@example.org');
    expect(mail.sendeInterneAnfrage).toHaveBeenCalledTimes(1);
    expect(mail.sendeInterneAnfrage.mock.calls[0][0]).toBe('team@example.org');
  });

  it('verwirft Honeypot-Treffer ohne Versand', async () => {
    const { service, mail } = baue(EMPF);
    await service.demo({ email: 'bot@example.org', webseite: 'http://spam' });
    expect(mail.sendeDemoZugang).not.toHaveBeenCalled();
    expect(mail.sendeInterneAnfrage).not.toHaveBeenCalled();
  });

  it('ist ohne ANFRAGE_EMPFAENGER nicht aktiv (404)', async () => {
    const { service } = baue();
    await expect(service.demo({ email: 'x@y.de' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('AnfrageService.pilot', () => {
  it('benachrichtigt das Team und bestätigt der anfragenden Person', async () => {
    const { service, mail } = baue(EMPF);
    await service.pilot({
      organisation: 'Solawi Beispiel',
      name: 'Alex',
      email: 'alex@example.org',
    });
    expect(mail.sendeInterneAnfrage).toHaveBeenCalledTimes(1);
    expect(mail.sendeInterneAnfrage.mock.calls[0][1]).toContain('Solawi Beispiel');
    expect(mail.sendePilotBestaetigung).toHaveBeenCalledWith(
      'alex@example.org',
      'Alex',
    );
  });

  it('ist ohne ANFRAGE_EMPFAENGER nicht aktiv (404)', async () => {
    const { service } = baue();
    await expect(
      service.pilot({ organisation: 'O', name: 'N', email: 'e@x.de' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
