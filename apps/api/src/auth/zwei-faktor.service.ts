import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

/** Gültigkeitsdauer des Login-Codes: 10 Minuten. */
const CODE_GUELTIG_MS = 10 * 60 * 1000;
/** Frühestens nach 60 Sekunden lässt sich ein neuer Code anfordern. */
const ERNEUT_SENDEN_SPERRE_MS = 60 * 1000;

/**
 * Einfache E-Mail-Zwei-Faktor-Authentisierung (kein TOTP/QR/Authenticator-App).
 * Ist 2FA aktiv, wird beim Login nach dem Passwort ein 6-stelliger Code an die
 * Konto-E-Mail geschickt; der Code wird argon2-gehasht mit kurzer Gültigkeit
 * gespeichert und beim Login verifiziert.
 */
@Injectable()
export class ZweiFaktorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /** Aktiviert 2FA für das eigene Konto (Code folgt beim nächsten Login). */
  async einschalten(personId: string): Promise<void> {
    await this.prisma.person.update({
      where: { id: personId },
      data: { zweiFaktorAktiv: true },
    });
  }

  /** Deaktiviert 2FA nach erneuter Passwortprüfung. */
  async ausschalten(personId: string, aktuellesPasswort: string): Promise<void> {
    const person = await this.prisma.person.findUnique({
      where: { id: personId },
      select: { passwortHash: true },
    });
    if (!person?.passwortHash) {
      throw new UnauthorizedException('Konto nicht gefunden.');
    }
    const passt = await argon2.verify(person.passwortHash, aktuellesPasswort);
    if (!passt) {
      throw new UnauthorizedException('Das aktuelle Passwort ist falsch.');
    }
    await this.prisma.person.update({
      where: { id: personId },
      data: {
        zweiFaktorAktiv: false,
        zweiFaktorCodeHash: null,
        zweiFaktorCodeLaeuftAbAm: null,
        zweiFaktorCodeGesendetAm: null,
      },
    });
  }

  /**
   * Erzeugt einen 6-stelligen Login-Code, speichert ihn gehasht (10 Min gültig)
   * und verschickt ihn per E-Mail. Merkt sich den Sendezeitpunkt für die
   * 60-Sekunden-Sperre beim erneuten Anfordern.
   */
  async codeSendenFuerLogin(personId: string): Promise<void> {
    const person = await this.prisma.person.findUnique({
      where: { id: personId },
      select: { loginEmail: true },
    });
    if (!person) return;

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = await argon2.hash(code, { type: argon2.argon2id });
    const jetzt = new Date();
    await this.prisma.person.update({
      where: { id: personId },
      data: {
        zweiFaktorCodeHash: codeHash,
        zweiFaktorCodeLaeuftAbAm: new Date(jetzt.getTime() + CODE_GUELTIG_MS),
        zweiFaktorCodeGesendetAm: jetzt,
      },
    });
    await this.mail.sendeLoginCode(person.loginEmail, code);
  }

  /**
   * Fordert während des Logins einen neuen Code an – frühestens 60 Sekunden nach
   * dem letzten Versand (sonst HTTP 429 mit Restwartezeit).
   */
  async codeErneutSenden(personId: string): Promise<void> {
    const person = await this.prisma.person.findUnique({
      where: { id: personId },
      select: { zweiFaktorAktiv: true, zweiFaktorCodeGesendetAm: true },
    });
    if (!person?.zweiFaktorAktiv) {
      throw new UnauthorizedException('Für dieses Konto ist keine 2FA aktiv.');
    }
    if (person.zweiFaktorCodeGesendetAm) {
      const verstrichen = Date.now() - person.zweiFaktorCodeGesendetAm.getTime();
      if (verstrichen < ERNEUT_SENDEN_SPERRE_MS) {
        const rest = Math.ceil((ERNEUT_SENDEN_SPERRE_MS - verstrichen) / 1000);
        throw new HttpException(
          `Bitte warte noch ${rest} Sekunden, bevor du einen neuen Code anforderst.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
    await this.codeSendenFuerLogin(personId);
  }

  /** Prüft den Login-Code gegen Hash + Ablauf; verbraucht ihn bei Erfolg. */
  async codeVerifizieren(personId: string, code: string): Promise<boolean> {
    const person = await this.prisma.person.findUnique({
      where: { id: personId },
      select: { zweiFaktorCodeHash: true, zweiFaktorCodeLaeuftAbAm: true },
    });
    if (!person?.zweiFaktorCodeHash || !person.zweiFaktorCodeLaeuftAbAm) {
      return false;
    }
    if (Date.now() > person.zweiFaktorCodeLaeuftAbAm.getTime()) {
      return false;
    }
    const passt = await argon2.verify(person.zweiFaktorCodeHash, code);
    if (!passt) return false;
    // Einmalgebrauch: Code nach erfolgreicher Prüfung entwerten.
    await this.prisma.person.update({
      where: { id: personId },
      data: {
        zweiFaktorCodeHash: null,
        zweiFaktorCodeLaeuftAbAm: null,
        zweiFaktorCodeGesendetAm: null,
      },
    });
    return true;
  }
}
