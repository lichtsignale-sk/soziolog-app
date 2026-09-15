import { HttpException, HttpStatus, Logger, NotFoundException } from '@nestjs/common';
import type { SitzungsPerson } from '../common/guards/sitzung.guard';
import type { FeedbackMailDaten } from '../mail/mail.service';
import type { FeedbackDto } from './dto/feedback.dto';
import {
  DEMO_HERKUNFT,
  EMPFAENGER_NAME_VORGABE,
  FEEDBACK_JE_STUNDE,
  FeedbackService,
} from './feedback.service';

const PERSON: SitzungsPerson = {
  id: 'p1',
  organisationId: 'o1',
  name: 'Alex Beispiel',
  nutzername: 'alex',
  loginEmail: 'alex@example.test',
  istAdmin: false,
  benachrichtigungenAktiv: true,
};

const DTO: FeedbackDto = {
  text: 'Der Knopf ist schwer zu finden.',
  seite: '/gesamt-log',
  seitenBezeichnung: 'Gesamt-Log',
  rueckfragenErlaubt: false,
};

function baue(
  env: Record<string, string> = { FEEDBACK_EMPFAENGER: 'team@example.test' },
  schalterAn = true,
) {
  const config = { get: jest.fn((k: string) => env[k]) };
  const prisma = {
    organisation: {
      findUnique: jest.fn().mockResolvedValue({ name: 'Solawi Rheintal' }),
    },
  };
  const gesendet: { empfaenger: string; daten: FeedbackMailDaten }[] = [];
  const mail = {
    sendeFeedback: jest.fn(async (empfaenger: string, daten: FeedbackMailDaten) => {
      gesendet.push({ empfaenger, daten });
    }),
  };
  const schalter = { istAn: jest.fn().mockResolvedValue(schalterAn) };
  const dienst = new FeedbackService(
    config as never,
    prisma as never,
    mail as never,
    schalter as never,
  );
  return { dienst, prisma, mail, schalter, gesendet };
}

describe('FeedbackService', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());

  it('ist ohne Empfänger aus und fragt den Schalter gar nicht', async () => {
    const { dienst, schalter } = baue({});
    expect(await dienst.status()).toEqual({
      aktiv: false,
      empfaengerName: EMPFAENGER_NAME_VORGABE,
    });
    await expect(dienst.sende(PERSON, DTO)).rejects.toBeInstanceOf(NotFoundException);
    expect(schalter.istAn).not.toHaveBeenCalled();
  });

  it('folgt dem Schalter', async () => {
    const aus = baue(undefined, false);
    expect((await aus.dienst.status()).aktiv).toBe(false);
    await expect(aus.dienst.sende(PERSON, DTO)).rejects.toBeInstanceOf(NotFoundException);
    expect(aus.mail.sendeFeedback).not.toHaveBeenCalled();

    const an = baue();
    expect((await an.dienst.status()).aktiv).toBe(true);
  });

  it('nennt den Empfänger so, wie der Betrieb es einstellt', async () => {
    const { dienst } = baue({
      FEEDBACK_EMPFAENGER: 'team@example.test',
      FEEDBACK_EMPFAENGER_NAME: '  das Team von Beispiel e. V.  ',
    });
    expect((await dienst.status()).empfaengerName).toBe('das Team von Beispiel e. V.');
  });

  it('gibt den Platz im Kontingent zurück, wenn der Versand scheitert', async () => {
    const { dienst, mail } = baue();
    mail.sendeFeedback.mockRejectedValue(new Error('weg'));
    for (let i = 0; i < FEEDBACK_JE_STUNDE + 5; i++) {
      await dienst.sende(PERSON, DTO).catch(() => undefined);
    }
    mail.sendeFeedback.mockResolvedValue(undefined);
    // Keiner der gescheiterten Versuche hat die Obergrenze verbraucht.
    await expect(dienst.sende(PERSON, DTO)).resolves.toBeUndefined();
  });

  it('schickt Organisation, Seite und Text — ohne Kontakt, wenn nicht erlaubt', async () => {
    const { dienst, gesendet, prisma } = baue({
      FEEDBACK_EMPFAENGER: 'team@example.test',
      APP_URL: 'https://solawi.example.test',
    });
    await dienst.sende(PERSON, DTO);

    expect(prisma.organisation.findUnique).toHaveBeenCalledWith({
      where: { id: 'o1' },
      select: { name: true },
    });
    expect(gesendet).toHaveLength(1);
    expect(gesendet[0].empfaenger).toBe('team@example.test');
    expect(gesendet[0].daten).toMatchObject({
      herkunft: 'Solawi Rheintal',
      demo: false,
      seite: '/gesamt-log',
      seitenBezeichnung: 'Gesamt-Log',
      instanz: 'https://solawi.example.test',
      text: DTO.text,
    });
    expect(gesendet[0].daten.kontakt).toBeUndefined();
    expect(gesendet[0].daten.datum).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('nimmt Name und Adresse aus der Sitzung, wenn Rückfragen erlaubt sind', async () => {
    const { dienst, gesendet } = baue();
    await dienst.sende(PERSON, { ...DTO, rueckfragenErlaubt: true });
    expect(gesendet[0].daten.kontakt).toEqual({
      name: 'Alex Beispiel',
      email: 'alex@example.test',
    });
  });

  it('nennt in der Demo keine Organisation und ignoriert das Häkchen', async () => {
    const { dienst, gesendet, prisma } = baue({
      FEEDBACK_EMPFAENGER: 'team@example.test',
      DEMO_MODE: '1',
    });
    await dienst.sende(PERSON, { ...DTO, rueckfragenErlaubt: true });
    expect(gesendet[0].daten.herkunft).toBe(DEMO_HERKUNFT);
    expect(gesendet[0].daten.demo).toBe(true);
    expect(gesendet[0].daten.kontakt).toBeUndefined();
    expect(prisma.organisation.findUnique).not.toHaveBeenCalled();
  });

  it('begrenzt die Mails je Stunde und Instanz', async () => {
    const { dienst } = baue();
    let uhr = 5_000_000;
    dienst.jetzt = () => uhr;
    for (let i = 0; i < FEEDBACK_JE_STUNDE; i++) await dienst.sende(PERSON, DTO);

    const fehler = await dienst.sende(PERSON, DTO).catch((e: unknown) => e);
    expect(fehler).toBeInstanceOf(HttpException);
    expect((fehler as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);

    uhr += 3_600_001;
    await expect(dienst.sende(PERSON, DTO)).resolves.toBeUndefined();
  });

  it('meldet einen Versandfehler freundlich und loggt den Text nicht', async () => {
    const { dienst, mail } = baue();
    mail.sendeFeedback.mockRejectedValueOnce(new Error('Verbindung abgelehnt'));
    const fehlerLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    const fehler = await dienst.sende(PERSON, DTO).catch((e: unknown) => e);
    expect((fehler as HttpException).getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);

    const alles = [...fehlerLog.mock.calls, ...log.mock.calls]
      .map((c) => String(c[0]))
      .join('\n');
    expect(alles).toContain('Verbindung abgelehnt');
    expect(alles).not.toContain(DTO.text);
  });
});
