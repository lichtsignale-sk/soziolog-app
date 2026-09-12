import { GoneException } from '@nestjs/common';
import { SetupService } from './setup.service';
import type { SetupDto } from './dto/setup.dto';

function dto(): SetupDto {
  return {
    smtp: { host: 'h', port: 1025, absender: 'a@b.c' },
    organisationName: 'Demo',
    hauptdomaene: { name: 'Kern', ziel: 'Z', tasks: ['D'] },
    startpersonen: [
      { name: 'A Admin', email: 'a@demo.test', rolle: 'admin' },
      { name: 'M Mod', email: 'm@demo.test', rolle: 'moderation' },
      { name: 'T Teil', email: 't@demo.test', rolle: 'teilhabender' },
    ],
  };
}

function baueService(env: Record<string, string> = {}) {
  const tx = {
    organisation: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: 'org1' }),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const prisma = {
    organisation: { findFirst: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
  };
  const konfig = { setzeSmtp: jest.fn().mockResolvedValue(undefined) };
  const mail = { sendeEinladung: jest.fn().mockResolvedValue(undefined) };
  const domaenen = { erstellenMit: jest.fn().mockResolvedValue({ id: 'k1' }) };
  let n = 0;
  const personen = {
    anlegen: jest.fn(async () => ({
      person: { id: `p${++n}` },
      einladungToken: `tok${n}`,
    })),
  };
  const einladung = { neuAusstellen: jest.fn() };
  const config = { get: (k: string, d?: string) => env[k] ?? d };
  const service = new SetupService(
    prisma as never,
    konfig as never,
    mail as never,
    domaenen as never,
    personen as never,
    einladung as never,
    config as never,
  );
  return { service, prisma, tx, konfig, mail, domaenen, personen };
}

describe('SetupService.status', () => {
  it('benoetigtSetup=true ohne Organisation', async () => {
    const { service, prisma } = baueService();
    (prisma.organisation.findFirst as jest.Mock).mockResolvedValue(null);
    expect(await service.status()).toEqual({
      benoetigtSetup: true,
      smtpVorhanden: false,
      demoModus: false,
    });
  });

  it('benoetigtSetup=false bei abgeschlossenem Setup', async () => {
    const { service, prisma } = baueService();
    (prisma.organisation.findFirst as jest.Mock).mockResolvedValue({
      setupAbgeschlossen: true,
    });
    expect(await service.status()).toEqual({
      benoetigtSetup: false,
      smtpVorhanden: false,
      demoModus: false,
    });
  });

  it('smtpVorhanden=true, wenn SMTP_HOST per Env gesetzt ist', async () => {
    const { service } = baueService({ SMTP_HOST: 'server2.example' });
    expect((await service.status()).smtpVorhanden).toBe(true);
  });

  it('demoModus=true, wenn DEMO_MODE=1 gesetzt ist', async () => {
    const { service } = baueService({ DEMO_MODE: '1' });
    expect((await service.status()).demoModus).toBe(true);
  });
});

describe('SetupService.durchfuehren', () => {
  it('legt Org/Domaene/3 Personen an und schließt das Setup ab', async () => {
    const { service, tx, konfig, domaenen, personen } = baueService();

    const ergebnis = await service.durchfuehren(dto());

    expect(konfig.setzeSmtp).toHaveBeenCalledTimes(1);
    expect(personen.anlegen).toHaveBeenCalledTimes(3);
    expect(domaenen.erstellenMit).toHaveBeenCalledTimes(1);
    expect(tx.organisation.update).toHaveBeenCalledWith({
      where: { id: 'org1' },
      data: { setupAbgeschlossen: true },
    });
    expect(ergebnis).toEqual({ erstellt: true, versandFehler: [] });
  });

  it('speichert KEINE SMTP-Konfig, wenn dto.smtp fehlt (Env-Relay-Fallback)', async () => {
    const { service, tx, konfig } = baueService();
    const ohneSmtp = dto();
    delete ohneSmtp.smtp;

    const ergebnis = await service.durchfuehren(ohneSmtp);

    expect(konfig.setzeSmtp).not.toHaveBeenCalled();
    expect(tx.organisation.update).toHaveBeenCalled();
    expect(ergebnis.erstellt).toBe(true);
  });

  it('bricht bei bereits vorhandener Organisation mit 410 ab', async () => {
    const { service, prisma } = baueService();
    (prisma.organisation.findFirst as jest.Mock).mockResolvedValue({ id: 'x' });
    await expect(service.durchfuehren(dto())).rejects.toBeInstanceOf(
      GoneException,
    );
  });

  it('E-Mail-Fehler bricht das Setup NICHT ab (Versand entkoppelt)', async () => {
    const { service, tx, mail } = baueService();
    mail.sendeEinladung.mockRejectedValue(new Error('smtp down'));

    const ergebnis = await service.durchfuehren(dto());

    // Setup gilt als abgeschlossen, Versandfehler werden gesammelt.
    expect(tx.organisation.update).toHaveBeenCalled();
    expect(ergebnis.erstellt).toBe(true);
    expect(ergebnis.versandFehler).toHaveLength(3);
  });
});
