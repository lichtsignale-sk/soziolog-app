import { NotFoundException } from '@nestjs/common';
import { BenachrichtigungService } from './benachrichtigung.service';
import type { MailService } from '../mail/mail.service';

function baueService() {
  const prisma = {
    benachrichtigung: { create: jest.fn(), findUnique: jest.fn() },
    benachrichtigungEmpfang: {
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    person: { findMany: jest.fn() },
  };
  const mail = { sendeBenachrichtigung: jest.fn().mockResolvedValue(undefined) };
  const service = new BenachrichtigungService(
    prisma as never,
    mail as unknown as MailService,
  );
  return { service, prisma, mail };
}

describe('BenachrichtigungService.erstelleFuerEmpfaenger – Präferenz & Isolation', () => {
  it('benachrichtigungenAktiv=false: KEINE E-Mail, aber Empfang bleibt bestehen', async () => {
    const { service, prisma, mail } = baueService();
    prisma.benachrichtigung.create.mockResolvedValue({
      id: 'b1',
      empfaenger: [{ id: 'e1', personId: 'p1' }],
    });
    prisma.person.findMany.mockResolvedValue([
      { id: 'p1', name: 'A', loginEmail: 'a@x', benachrichtigungenAktiv: false },
    ]);

    await service.erstelleFuerEmpfaenger(
      { typ: 'ueberpruefung_faellig', inhalt: 'x' },
      ['p1'],
    );

    // Empfang wurde angelegt (create), aber keine Mail und kein perEmailGesendet.
    expect(prisma.benachrichtigung.create).toHaveBeenCalledTimes(1);
    expect(mail.sendeBenachrichtigung).not.toHaveBeenCalled();
    expect(prisma.benachrichtigungEmpfang.update).not.toHaveBeenCalled();
  });

  it('benachrichtigungenAktiv=true: E-Mail senden und perEmailGesendet setzen', async () => {
    const { service, prisma, mail } = baueService();
    prisma.benachrichtigung.create.mockResolvedValue({
      id: 'b1',
      empfaenger: [{ id: 'e1', personId: 'p1' }],
    });
    prisma.person.findMany.mockResolvedValue([
      { id: 'p1', name: 'A', loginEmail: 'a@x', benachrichtigungenAktiv: true },
    ]);

    await service.erstelleFuerEmpfaenger(
      { typ: 'ueberpruefung_faellig', inhalt: 'x' },
      ['p1'],
    );

    expect(mail.sendeBenachrichtigung).toHaveBeenCalledTimes(1);
    expect(prisma.benachrichtigungEmpfang.update).toHaveBeenCalledWith({
      where: { id: 'e1' },
      data: { perEmailGesendet: true },
    });
  });

  it('E-Mail-Fehler bei einem Empfänger blockiert die übrigen nicht', async () => {
    const { service, prisma, mail } = baueService();
    prisma.benachrichtigung.create.mockResolvedValue({
      id: 'b1',
      empfaenger: [
        { id: 'e1', personId: 'p1' },
        { id: 'e2', personId: 'p2' },
      ],
    });
    prisma.person.findMany.mockResolvedValue([
      { id: 'p1', name: 'A', loginEmail: 'a@x', benachrichtigungenAktiv: true },
      { id: 'p2', name: 'B', loginEmail: 'b@x', benachrichtigungenAktiv: true },
    ]);
    mail.sendeBenachrichtigung
      .mockRejectedValueOnce(new Error('smtp down'))
      .mockResolvedValueOnce(undefined);

    await expect(
      service.erstelleFuerEmpfaenger(
        { typ: 'ueberpruefung_faellig', inhalt: 'x' },
        ['p1', 'p2'],
      ),
    ).resolves.toBeUndefined();

    expect(mail.sendeBenachrichtigung).toHaveBeenCalledTimes(2);
    // Nur für den erfolgreichen Empfänger wird perEmailGesendet gesetzt.
    expect(prisma.benachrichtigungEmpfang.update).toHaveBeenCalledTimes(1);
    expect(prisma.benachrichtigungEmpfang.update).toHaveBeenCalledWith({
      where: { id: 'e2' },
      data: { perEmailGesendet: true },
    });
  });
});

describe('BenachrichtigungService – Lesestatus & Lesestand', () => {
  it('lesestand: 0 von 3 gelesen ist auffällig', async () => {
    const { service, prisma } = baueService();
    prisma.benachrichtigung.findUnique.mockResolvedValue({ id: 'b1' });
    prisma.benachrichtigungEmpfang.count.mockImplementation(
      async (args: { where: { gelesen?: boolean } }) =>
        args.where.gelesen === true ? 0 : 3,
    );

    const stand = await service.lesestand('b1');
    expect(stand).toEqual({ gelesen: 0, gesamt: 3, auffaellig: true });
  });

  it('lesestand: unbekannte Benachrichtigung -> 404', async () => {
    const { service, prisma } = baueService();
    prisma.benachrichtigung.findUnique.mockResolvedValue(null);
    await expect(service.lesestand('x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('alsGelesen setzt gelesen für die Person; 404 wenn kein Empfang', async () => {
    const { service, prisma } = baueService();
    prisma.benachrichtigungEmpfang.updateMany.mockResolvedValue({ count: 1 });
    await service.alsGelesen('b1', 'p1');
    expect(prisma.benachrichtigungEmpfang.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { benachrichtigungId: 'b1', personId: 'p1' },
        data: expect.objectContaining({ gelesen: true }),
      }),
    );

    prisma.benachrichtigungEmpfang.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.alsGelesen('b1', 'p2')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
