import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { heute } from '@soziolog/shared';
import type { SitzungsPerson } from '../common/guards/sitzung.guard';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { APP_VERSION } from '../version';
import type { FeedbackDto } from './dto/feedback.dto';
import { FeedbackSchalterService } from './feedback-schalter.service';

/** So erscheint die Herkunft, wenn die Instanz eine öffentliche Demo ist. */
export const DEMO_HERKUNFT = 'Eine Person in der Demo';

/**
 * Höchstens so viele Feedback-Mails je Stunde und Instanz.
 *
 * Das Rate-Limit an der Route zählt je Adresse. In einer Demo teilen sich
 * aber alle dasselbe Konto — ohne diese Obergrenze wäre das Formular dort ein
 * bequemer Weg, das Postfach des Teams zu fluten.
 */
export const FEEDBACK_JE_STUNDE = 30;

/** Neutrale Bezeichnung, solange `FEEDBACK_EMPFAENGER_NAME` fehlt. */
export const EMPFAENGER_NAME_VORGABE = 'das Team, das diese Instanz betreut';

export interface FeedbackStatus {
  aktiv: boolean;
  /** Für den Hinweis im Dialog: „Dein Feedback geht direkt an …". */
  empfaengerName: string;
}

/**
 * Feedback aus der App per Mail an `FEEDBACK_EMPFAENGER`.
 *
 * DER TEXT WIRD NIE GELOGGT und nirgends gespeichert. Er kann Namen und
 * Einzelheiten aus der Organisation enthalten; er gehört in das Postfach, an
 * das er gerichtet ist, und nicht in ein Container-Log.
 */
@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);
  private versandzeiten: number[] = [];

  /** Uhr, in Tests austauschbar. */
  jetzt: () => number = Date.now;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly schalter: FeedbackSchalterService,
  ) {}

  private empfaenger(): string | undefined {
    const wert = this.config.get<string>('FEEDBACK_EMPFAENGER')?.trim();
    return wert ? wert : undefined;
  }

  /**
   * Wie die App den Empfänger nennt („Dein Feedback geht direkt an …").
   * Die Vorgabe ist bewusst allgemein: Wer die Instanz selbst betreibt,
   * bekommt das Feedback selbst.
   */
  private empfaengerName(): string {
    const wert = this.config.get<string>('FEEDBACK_EMPFAENGER_NAME')?.trim();
    return wert ? wert.slice(0, 80) : EMPFAENGER_NAME_VORGABE;
  }

  /** Ist das Modul an? Ohne Empfänger fragt die Instanz niemanden. */
  async status(): Promise<FeedbackStatus> {
    const empfaengerName = this.empfaengerName();
    if (!this.empfaenger()) return { aktiv: false, empfaengerName };
    return { aktiv: await this.schalter.istAn(), empfaengerName };
  }

  async sende(person: SitzungsPerson, dto: FeedbackDto): Promise<void> {
    const empfaenger = this.empfaenger();
    if (!empfaenger || !(await this.schalter.istAn())) {
      throw new NotFoundException('Feedback ist derzeit nicht verfügbar.');
    }
    const marke = this.pruefeObergrenze();

    const demo = this.config.get<string>('DEMO_MODE') === '1';
    const herkunft = demo ? DEMO_HERKUNFT : await this.organisationsname(person);
    // In der Demo teilen sich alle ein Konto — dessen Name und Adresse
    // gehören zu niemandem. Das Häkchen gibt es dort nicht; kommt es doch,
    // zählt es nicht.
    const kontakt =
      !demo && dto.rueckfragenErlaubt
        ? { name: person.name, email: person.loginEmail }
        : undefined;

    try {
      await this.mail.sendeFeedback(empfaenger, {
        herkunft,
        demo,
        seite: dto.seite,
        seitenBezeichnung: dto.seitenBezeichnung,
        instanz: this.config.get<string>('APP_URL') || undefined,
        version: APP_VERSION,
        datum: heute(),
        text: dto.text,
        kontakt,
      });
    } catch (e) {
      // Was nicht hinausging, zählt nicht gegen die Obergrenze.
      this.gibFrei(marke);
      // Nur der Grund des Mailservers, nie der Text.
      this.logger.error(
        `Feedback-Mail nicht versendet: ${e instanceof Error ? e.message : 'unbekannter Fehler'}`,
      );
      throw new ServiceUnavailableException(
        'Dein Feedback konnte gerade nicht versendet werden. Bitte versuche es später noch einmal.',
      );
    }
    this.logger.log('Feedback versendet.');
  }

  private async organisationsname(person: SitzungsPerson): Promise<string> {
    const org = await this.prisma.organisation.findUnique({
      where: { id: person.organisationId },
      select: { name: true },
    });
    return org?.name ?? 'Unbekannte Organisation';
  }

  /** Belegt einen Platz im Stundenkontingent und gibt seine Marke zurück. */
  private pruefeObergrenze(): number {
    const jetzt = this.jetzt();
    this.versandzeiten = this.versandzeiten.filter((t) => t > jetzt - 3_600_000);
    if (this.versandzeiten.length >= FEEDBACK_JE_STUNDE) {
      throw new HttpException(
        'Gerade kommen sehr viele Rückmeldungen an. Bitte versuche es später noch einmal.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.versandzeiten.push(jetzt);
    return jetzt;
  }

  private gibFrei(marke: number): void {
    const i = this.versandzeiten.lastIndexOf(marke);
    if (i >= 0) this.versandzeiten.splice(i, 1);
  }
}
