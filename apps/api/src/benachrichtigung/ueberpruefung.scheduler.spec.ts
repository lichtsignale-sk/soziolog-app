import { UeberpruefungScheduler } from './ueberpruefung.scheduler';
import type { GueltigkeitService } from '../gueltigkeit/gueltigkeit.service';
import type { BenachrichtigungService } from './benachrichtigung.service';

function baueScheduler() {
  const prisma = {
    benachrichtigung: { findFirst: jest.fn() },
    beschluss: { findUnique: jest.fn() },
    mitgliedschaft: { findMany: jest.fn() },
  };
  const gueltigkeit = {
    faelligeUeberpruefungen: jest.fn(),
    markiereFaelligeAlsInUeberpruefung: jest.fn().mockResolvedValue(0),
  };
  const benachrichtigung = { erstelleFuerEmpfaenger: jest.fn() };
  const scheduler = new UeberpruefungScheduler(
    prisma as never,
    gueltigkeit as unknown as GueltigkeitService,
    benachrichtigung as unknown as BenachrichtigungService,
  );
  return { scheduler, prisma, gueltigkeit, benachrichtigung };
}

const faelligerBeschluss = {
  id: 'b1',
  vorschlagId: 'v1',
  titel: 'Kaffeekasse',
  gueltigAb: '2026-01-01',
  ueberpruefungsdatum: '2026-07-05',
};

describe('UeberpruefungScheduler.verarbeiteFaellige', () => {
  it('legt je Beschluss eine Benachrichtigung an die Teilhabenden an', async () => {
    const { scheduler, prisma, gueltigkeit, benachrichtigung } = baueScheduler();
    gueltigkeit.faelligeUeberpruefungen.mockResolvedValue([faelligerBeschluss]);
    prisma.benachrichtigung.findFirst.mockResolvedValue(null); // noch keine
    prisma.beschluss.findUnique.mockResolvedValue({ vorschlag: { domaeneId: 'k1' } });
    prisma.mitgliedschaft.findMany.mockResolvedValue([
      { personId: 'p1' },
      { personId: 'p2' },
    ]);

    const anzahl = await scheduler.verarbeiteFaellige('2026-07-05');

    expect(anzahl).toBe(1);
    expect(benachrichtigung.erstelleFuerEmpfaenger).toHaveBeenCalledTimes(1);
    const [daten, empfaenger] =
      benachrichtigung.erstelleFuerEmpfaenger.mock.calls[0];
    expect(daten).toMatchObject({
      typ: 'ueberpruefung_faellig',
      betrifftBeschlussId: 'b1',
      domaeneId: 'k1',
    });
    expect(empfaenger).toEqual(['p1', 'p2']);
    expect(gueltigkeit.markiereFaelligeAlsInUeberpruefung).toHaveBeenCalledWith(
      '2026-07-05',
    );
  });

  it('ist idempotent: existiert schon eine Benachrichtigung, wird keine erneut angelegt', async () => {
    const { scheduler, prisma, gueltigkeit, benachrichtigung } = baueScheduler();
    gueltigkeit.faelligeUeberpruefungen.mockResolvedValue([faelligerBeschluss]);
    prisma.benachrichtigung.findFirst.mockResolvedValue({ id: 'schon-da' });

    const anzahl = await scheduler.verarbeiteFaellige('2026-07-05');

    expect(anzahl).toBe(0);
    expect(benachrichtigung.erstelleFuerEmpfaenger).not.toHaveBeenCalled();
    // Der Status-Flip läuft trotzdem.
    expect(gueltigkeit.markiereFaelligeAlsInUeberpruefung).toHaveBeenCalled();
  });
});
