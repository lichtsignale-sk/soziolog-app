import { Logger } from '@nestjs/common';
import {
  FeedbackSchalterService,
  SCHALTER_FEHLERPAUSE_MS,
  SCHALTER_FRISCH_MS,
} from './feedback-schalter.service';

function antwort(koerper: unknown, status = 200): Response {
  return new Response(JSON.stringify(koerper), { status });
}

function baue(url: string | null = 'https://schalter.example.test/api/schalter') {
  const config = {
    get: jest.fn((k: string) => (k === 'FEEDBACK_SCHALTER_URL' ? (url ?? undefined) : undefined)),
  };
  const dienst = new FeedbackSchalterService(config as never);
  let uhr = 1_000_000;
  dienst.jetzt = () => uhr;
  const abruf = jest.fn<Promise<Response>, [unknown, unknown]>();
  dienst.abruf = abruf as unknown as typeof fetch;
  return {
    dienst,
    abruf,
    vorspulen: (ms: number) => {
      uhr += ms;
    },
  };
}

/** Lässt ausstehende Hintergrund-Abrufe fertig werden. */
const hintergrund = () => new Promise((r) => setImmediate(r));

describe('FeedbackSchalterService', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());

  it('ist ohne Adresse an und fragt niemanden', async () => {
    const { dienst, abruf } = baue(null);
    expect(await dienst.istAn()).toBe(true);
    expect(abruf).not.toHaveBeenCalled();
  });

  it('übernimmt die Antwort und hält sie fünf Minuten vor', async () => {
    const { dienst, abruf, vorspulen } = baue();
    abruf.mockResolvedValue(antwort({ feedback: false }));
    expect(await dienst.istAn()).toBe(false);
    vorspulen(SCHALTER_FRISCH_MS - 1);
    expect(await dienst.istAn()).toBe(false);
    expect(abruf).toHaveBeenCalledTimes(1);
  });

  it('antwortet nach Ablauf sofort mit dem alten Stand und erneuert im Hintergrund', async () => {
    const { dienst, abruf, vorspulen } = baue();
    abruf.mockResolvedValueOnce(antwort({ feedback: true }));
    await dienst.istAn();

    vorspulen(SCHALTER_FRISCH_MS + 1);
    abruf.mockResolvedValueOnce(antwort({ feedback: false }));
    expect(await dienst.istAn()).toBe(true); // noch der alte Stand
    await hintergrund();
    expect(await dienst.istAn()).toBe(false);
    expect(abruf).toHaveBeenCalledTimes(2);
  });

  it('gilt als an, wenn die Gegenstelle nie erreichbar war — und fragt nicht bei jedem Aufruf', async () => {
    const { dienst, abruf, vorspulen } = baue();
    abruf.mockRejectedValue(new TypeError('fetch failed'));
    expect(await dienst.istAn()).toBe(true);
    expect(await dienst.istAn()).toBe(true);
    expect(abruf).toHaveBeenCalledTimes(1);

    vorspulen(SCHALTER_FEHLERPAUSE_MS + 1);
    await dienst.istAn();
    expect(abruf).toHaveBeenCalledTimes(2);
  });

  it('behält bei einem Ausfall den letzten bekannten Stand', async () => {
    const { dienst, abruf, vorspulen } = baue();
    abruf.mockResolvedValueOnce(antwort({ feedback: false }));
    await dienst.istAn();

    vorspulen(SCHALTER_FRISCH_MS + 1);
    abruf.mockRejectedValueOnce(new TypeError('fetch failed'));
    expect(await dienst.istAn()).toBe(false);
    await hintergrund();
    expect(await dienst.istAn()).toBe(false);
  });

  it.each([
    ['fehlendes Feld', antwort({})],
    ['falscher Typ', antwort({ feedback: 'nein' })],
    ['kein JSON-Objekt', antwort(null)],
    ['Fehlerstatus', antwort({ feedback: false }, 500)],
  ])('nimmt %s nicht als Antwort', async (_, a) => {
    const { dienst, abruf } = baue();
    abruf.mockResolvedValue(a);
    expect(await dienst.istAn()).toBe(true);
  });

  it('fragt bei gleichzeitigen Aufrufen nur einmal', async () => {
    const { dienst, abruf } = baue();
    abruf.mockResolvedValue(antwort({ feedback: true }));
    await Promise.all([dienst.istAn(), dienst.istAn(), dienst.istAn()]);
    expect(abruf).toHaveBeenCalledTimes(1);
  });

  it('meldet einen Ausfall nur einmal und nie mit Antwortinhalt', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const { dienst, abruf, vorspulen } = baue();
    abruf.mockResolvedValue(antwort({ geheim: 'inhalt' }));
    await dienst.istAn();
    vorspulen(SCHALTER_FEHLERPAUSE_MS + 1);
    await dienst.istAn();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).not.toContain('inhalt');
  });
});
