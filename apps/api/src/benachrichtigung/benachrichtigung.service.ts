import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { heute, zuDatum, datumStringAusDate } from '@soziolog/shared';
import type {
  BenachrichtigungTyp,
  BenachrichtigungDTO,
  KorrekturZielTyp,
  LesestandDTO,
} from '@soziolog/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

/** Daten für eine neue Benachrichtigung (Empfänger separat). */
export interface BenachrichtigungDaten {
  typ: BenachrichtigungTyp;
  inhalt: string;
  domaeneId?: string | null;
  betrifftBeschlussId?: string | null;
  betrifftKorrekturId?: string | null;
  betrifftVorschlagId?: string | null;
  faelligAm?: string | null;
}

@Injectable()
export class BenachrichtigungService {
  private readonly logger = new Logger(BenachrichtigungService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /**
   * Legt EINE Benachrichtigung an, je Empfänger einen BenachrichtigungEmpfang,
   * und versendet – nur bei person.benachrichtigungenAktiv – eine E-Mail. Der
   * Empfang bleibt immer im System (auch ohne E-Mail). Jeder Versand ist
   * isoliert: ein Fehler blockiert die übrigen Empfänger nicht.
   */
  async erstelleFuerEmpfaenger(
    daten: BenachrichtigungDaten,
    empfaengerIds: string[],
  ): Promise<void> {
    const ids = [...new Set(empfaengerIds)];
    if (ids.length === 0) return;

    const benachrichtigung = await this.prisma.benachrichtigung.create({
      data: {
        typ: daten.typ,
        inhalt: daten.inhalt,
        domaeneId: daten.domaeneId ?? null,
        betrifftBeschlussId: daten.betrifftBeschlussId ?? null,
        betrifftKorrekturId: daten.betrifftKorrekturId ?? null,
        betrifftVorschlagId: daten.betrifftVorschlagId ?? null,
        faelligAm: daten.faelligAm ? zuDatum(daten.faelligAm) : null,
        erstelltAm: zuDatum(heute()),
        empfaenger: { create: ids.map((personId) => ({ personId })) },
      },
      include: { empfaenger: true },
    });

    const personen = await this.prisma.person.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        loginEmail: true,
        benachrichtigungenAktiv: true,
      },
    });
    const proPerson = new Map(personen.map((p) => [p.id, p]));

    for (const empfang of benachrichtigung.empfaenger) {
      const person = proPerson.get(empfang.personId);
      if (!person || !person.benachrichtigungenAktiv) continue;
      try {
        await this.mail.sendeBenachrichtigung(
          person.loginEmail,
          person.name,
          daten.typ,
          daten.inhalt,
        );
        await this.prisma.benachrichtigungEmpfang.update({
          where: { id: empfang.id },
          data: { perEmailGesendet: true },
        });
      } catch (e) {
        // E-Mail-Fehler isolieren: Schleife läuft weiter, Empfang bleibt sichtbar.
        this.logger.error(
          `Benachrichtigungs-Mail an ${person.loginEmail} fehlgeschlagen: ${
            e instanceof Error ? e.message : e
          }`,
        );
      }
    }
  }

  /**
   * Eigene Benachrichtigungen der Person, neueste zuerst. „Korrekturantrag zu
   * bestätigen"-Einträge (korrektur_beantragt) verschwinden, sobald der Antrag
   * entschieden ist – dann ist nichts mehr zu tun.
   */
  async meine(personId: string): Promise<BenachrichtigungDTO[]> {
    const empfaenge = await this.prisma.benachrichtigungEmpfang.findMany({
      where: { personId },
      orderBy: { benachrichtigung: { erstelltAm: 'desc' } },
      include: {
        benachrichtigung: {
          include: {
            domaene: { select: { name: true } },
            betrifftBeschluss: {
              select: { vorschlag: { select: { id: true, domaeneId: true } } },
            },
            betrifftKorrektur: { select: { zielTyp: true, status: true } },
          },
        },
      },
    });

    return empfaenge
      .filter((e) => {
        const b = e.benachrichtigung;
        // Offene Korrekturanträge nur, solange sie noch zu bestätigen sind.
        return !(
          b.typ === 'korrektur_beantragt' &&
          b.betrifftKorrektur &&
          b.betrifftKorrektur.status !== 'offen'
        );
      })
      .map((e) => {
        const b = e.benachrichtigung;
        return {
          id: b.id,
          typ: b.typ as BenachrichtigungTyp,
          inhalt: b.inhalt,
          domaeneId: b.domaeneId,
          domaeneName: b.domaene?.name ?? null,
          faelligAm: b.faelligAm ? datumStringAusDate(b.faelligAm) : null,
          erstelltAm: datumStringAusDate(b.erstelltAm),
          gelesen: e.gelesen,
          gelesenAm: e.gelesenAm ? datumStringAusDate(e.gelesenAm) : null,
          betrifftBeschlussId: b.betrifftBeschlussId,
          vorschlagId: b.betrifftVorschlagId ?? b.betrifftBeschluss?.vorschlag.id ?? null,
          betrifftKorrekturId: b.betrifftKorrekturId,
          korrekturZielTyp: (b.betrifftKorrektur?.zielTyp as KorrekturZielTyp) ?? null,
        } satisfies BenachrichtigungDTO;
      });
  }

  /**
   * Markiert alle Benachrichtigungen eines Typs für die Person als gelesen –
   * z. B. „korrektur_beantragt", wenn der Admin den Korrekturanträge-Tab öffnet
   * (das reine Öffnen des Popovers gilt bewusst NICHT als Anschauen).
   */
  async markiereTypGelesen(personId: string, typ: BenachrichtigungTyp): Promise<void> {
    await this.prisma.benachrichtigungEmpfang.updateMany({
      where: { personId, gelesen: false, benachrichtigung: { is: { typ } } },
      data: { gelesen: true, gelesenAm: zuDatum(heute()) },
    });
  }

  /**
   * Entfernt die „zu bestätigen"-Benachrichtigungen eines Korrekturantrags (für
   * alle Empfänger), sobald er bestätigt oder abgelehnt wurde – so verschwinden
   * sie überall aus dem Popover.
   */
  async entferneKorrekturBeantragt(korrekturId: string): Promise<void> {
    await this.prisma.benachrichtigung.deleteMany({
      where: { typ: 'korrektur_beantragt', betrifftKorrekturId: korrekturId },
    });
  }

  /**
   * Entfernt die „Überprüfung fällig"-Benachrichtigungen eines Beschlusses.
   * Wird gerufen, sobald die Fälligkeit erledigt ist (bestätigt/ersetzt/beendet):
   * die offene Aufgabe verschwindet bei allen, und ein späterer Fristzyklus kann
   * erneut benachrichtigen. Empfänge cascaden mit der Benachrichtigung.
   */
  async entferneUeberpruefungFaellig(beschlussId: string): Promise<void> {
    await this.prisma.benachrichtigung.deleteMany({
      where: { typ: 'ueberpruefung_faellig', betrifftBeschlussId: beschlussId },
    });
  }

  /** Anzahl ungelesener Benachrichtigungen der Person (entschiedene Korrektur-
   *  anträge zählen nicht, konsistent zur Liste). */
  async anzahlUngelesen(personId: string): Promise<number> {
    return this.prisma.benachrichtigungEmpfang.count({
      where: {
        personId,
        gelesen: false,
        benachrichtigung: {
          is: {
            NOT: {
              typ: 'korrektur_beantragt',
              betrifftKorrektur: { is: { status: { not: 'offen' } } },
            },
          },
        },
      },
    });
  }

  /** Markiert die Benachrichtigung für diese Person als gelesen. */
  async alsGelesen(benachrichtigungId: string, personId: string): Promise<void> {
    const { count } = await this.prisma.benachrichtigungEmpfang.updateMany({
      where: { benachrichtigungId, personId },
      data: { gelesen: true, gelesenAm: zuDatum(heute()) },
    });
    if (count === 0) {
      throw new NotFoundException('Benachrichtigung nicht gefunden.');
    }
  }

  /** Lesestand einer Benachrichtigung (wie viele der Empfänger gelesen haben). */
  async lesestand(benachrichtigungId: string): Promise<LesestandDTO> {
    const vorhanden = await this.prisma.benachrichtigung.findUnique({
      where: { id: benachrichtigungId },
      select: { id: true },
    });
    if (!vorhanden) throw new NotFoundException('Benachrichtigung nicht gefunden.');

    const [gesamt, gelesen] = await Promise.all([
      this.prisma.benachrichtigungEmpfang.count({ where: { benachrichtigungId } }),
      this.prisma.benachrichtigungEmpfang.count({
        where: { benachrichtigungId, gelesen: true },
      }),
    ]);
    return { gelesen, gesamt, auffaellig: gesamt > 0 && gelesen === 0 };
  }
}
