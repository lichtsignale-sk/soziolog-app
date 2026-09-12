import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import * as argon2 from 'argon2';
import { heute, datumPlusTage, zuDatum, datumStringAusDate } from '@soziolog/shared';
import type { AktuellePersonDTO, RolleTyp } from '@soziolog/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import type { SitzungsPerson } from '../common/guards/sitzung.guard';
import { istGesperrt, sperrEnde, sperreErreicht } from './anmeldesperre';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Vergleichshash für Anmeldeversuche auf Konten, die es nicht gibt.
   *
   * Einmal je Prozess erzeugt und dann festgehalten; der Klartext dahinter ist
   * zufällig und wird nie gebraucht. Es geht allein um die Rechenzeit.
   */
  private vergleichshashCache: Promise<string> | null = null;

  private vergleichshash(): Promise<string> {
    if (!this.vergleichshashCache) {
      this.vergleichshashCache = argon2.hash(
        randomBytes(32).toString('hex'),
        { type: argon2.argon2id },
      );
    }
    return this.vergleichshashCache;
  }

  /**
   * Verbrennt dieselbe Zeit wie eine echte Passwortprüfung.
   *
   * WARUM: `argon2.verify` braucht bewusst lange (dreistellige Millisekunden).
   * Wurde es bei unbekannter Kennung gar nicht erst aufgerufen, antwortete die
   * API dort messbar schneller als bei bekannter — trotz identischer
   * Fehlermeldung. Damit liess sich abfragen, welche E-Mail-Adressen ein Konto
   * haben (Konto-Aufzählung). Der Vergleich hier schlägt immer fehl; sein
   * Ergebnis wird verworfen, gebraucht wird nur die Dauer.
   *
   * Gleiches Vorgehen wie in der Verwaltung (auth/gleichlange-antwort.ts).
   */
  private async gleichlangeAntwort(passwort: string): Promise<void> {
    try {
      await argon2.verify(await this.vergleichshash(), passwort);
    } catch {
      // Bedeutungslos — der Aufruf zählt, nicht sein Ausgang.
    }
  }

  /**
   * Signiert das Session-JWT (7 Tage) für das httpOnly-Cookie.
   *
   * Der Stand von `sitzungsGeneration` wird MITSIGNIERT und beim nächsten
   * Aufruf vom SitzungGuard verglichen. Er wird hier frisch gelesen statt vom
   * Aufrufer übernommen: Der Wert muss der aktuelle sein, sonst stellt ein
   * Rennen zwischen Anmeldung und Passwortwechsel ein bereits entwertetes Token
   * aus.
   */
  async erstelleSitzungsToken(person: {
    id: string;
    istAdmin: boolean;
  }): Promise<string> {
    const stand = await this.prisma.person.findUnique({
      where: { id: person.id },
      select: { sitzungsGeneration: true },
    });
    if (!stand) {
      throw new UnauthorizedException('Anmeldung fehlgeschlagen.');
    }
    return this.jwt.signAsync(
      {
        sub: person.id,
        istAdmin: person.istAdmin,
        gen: stand.sitzungsGeneration,
      },
      { secret: this.config.get<string>('JWT_SECRET'), expiresIn: '7d' },
    );
  }

  private zuSitzungsPerson(person: {
    id: string;
    organisationId: string;
    name: string;
    nutzername: string;
    loginEmail: string;
    istAdmin: boolean;
    benachrichtigungenAktiv: boolean;
  }): SitzungsPerson {
    return {
      id: person.id,
      organisationId: person.organisationId,
      name: person.name,
      nutzername: person.nutzername,
      loginEmail: person.loginEmail,
      istAdmin: person.istAdmin,
      benachrichtigungenAktiv: person.benachrichtigungenAktiv,
    };
  }

  /**
   * Prüft Anmeldedaten. Bei jedem Fehler (unbekannt, inaktiv, falsches Passwort)
   * dieselbe generische Meldung – keine Rückschlüsse auf Existenz eines Kontos.
   * Gibt zusätzlich zurück, ob 2FA aktiv ist (dann folgt ein E-Mail-Code-Schritt).
   */
  async login(
    nutzernameOderEmail: string,
    passwort: string,
  ): Promise<{ person: SitzungsPerson; zweiFaktorAktiv: boolean }> {
    const fehler = new UnauthorizedException('Anmeldung fehlgeschlagen.');

    // Die E-Mail ohne Rücksicht auf Groß- und Kleinschreibung
    // (`personIdPerEmail`); der Nutzername bleibt exakt, wie er ist.
    const idPerEmail = await this.personIdPerEmail(nutzernameOderEmail);
    const person = await this.prisma.person.findFirst({
      where: {
        OR: [
          { nutzername: nutzernameOderEmail },
          ...(idPerEmail !== null ? [{ id: idPerEmail }] : []),
        ],
      },
    });

    if (!person || !person.aktiv || !person.passwortHash) {
      // NICHT einfach werfen: ohne diesen Schritt antwortet die API bei
      // unbekannter Kennung messbar schneller als bei bekannter.
      await this.gleichlangeAntwort(passwort);
      throw fehler;
    }

    // Gesperrte Konten werden gar nicht erst geprüft — aber mit derselben Dauer
    // und derselben Meldung wie ein falsches Passwort. Eine eigene Meldung
    // („Konto gesperrt") würde verraten, dass es das Konto gibt, und wäre damit
    // genau die Aufzählung, die `gleichlangeAntwort` verhindert.
    if (istGesperrt(person.gesperrtBis)) {
      await this.gleichlangeAntwort(passwort);
      throw fehler;
    }

    const passt = await argon2.verify(person.passwortHash, passwort);
    if (!passt) {
      await this.merkeFehlversuch(person.id);
      throw fehler;
    }

    await this.setzeFehlversucheZurueck(person);

    return {
      person: this.zuSitzungsPerson(person),
      zweiFaktorAktiv: person.zweiFaktorAktiv,
    };
  }

  /**
   * Zählt einen Fehlversuch und sperrt bei Erreichen der Schwelle.
   *
   * Scheitert der Schreibvorgang, wird das protokolliert, aber die Anmeldung
   * bleibt abgelehnt: Ein Datenbankproblem darf niemals dazu führen, dass ein
   * falsches Passwort durchgeht. Die ursprüngliche Ablehnung wirft der Aufrufer.
   */
  private async merkeFehlversuch(personId: string): Promise<void> {
    try {
      // ATOMAR HOCHZÄHLEN, nicht `gelesener Stand + 1` schreiben. Bei
      // gleichzeitig eintreffenden Versuchen lesen sonst alle denselben Stand
      // und schreiben denselben Wert: Von hundert parallelen Versuchen zählt
      // genau einer, und die Sperre greift erst nach dem Vielfachen der
      // Schwelle. Genau so umgeht man sie mit einer Handvoll Adressen.
      const stand = await this.prisma.person.update({
        where: { id: personId },
        data: { fehlversuche: { increment: 1 } },
        select: { fehlversuche: true },
      });

      // Die Entscheidung faellt auf dem ZURUECKGEGEBENEN Stand, nicht auf dem
      // vorher gelesenen. Setzen zwei Anfragen die Sperre gleichzeitig, ist das
      // folgenlos — beide schreiben dasselbe.
      if (sperreErreicht(stand.fehlversuche)) {
        await this.prisma.person.update({
          where: { id: personId },
          data: { fehlversuche: 0, gesperrtBis: sperrEnde() },
        });
      }
    } catch (ausnahme) {
      const grund =
        ausnahme instanceof Error ? ausnahme.message : String(ausnahme);
      this.logger.error(
        `Fehlversuch für ${personId} konnte nicht gezählt werden: ${grund}.`,
      );
    }
  }

  /**
   * Setzt Zähler und Sperre nach erfolgreicher Anmeldung zurück — aber nur,
   * wenn es etwas zurückzusetzen gibt. Sonst schriebe jede Anmeldung eine
   * Zeile, die sich nicht ändert.
   */
  private async setzeFehlversucheZurueck(person: {
    id: string;
    fehlversuche: number;
    gesperrtBis: Date | null;
  }): Promise<void> {
    if (person.fehlversuche === 0 && person.gesperrtBis === null) return;
    try {
      await this.prisma.person.updateMany({
        where: { id: person.id },
        data: { fehlversuche: 0, gesperrtBis: null },
      });
    } catch (ausnahme) {
      const grund =
        ausnahme instanceof Error ? ausnahme.message : String(ausnahme);
      this.logger.error(
        `Fehlversuche von ${person.id} konnten nicht zurückgesetzt werden: ${grund}.`,
      );
    }
  }

  /**
   * Hält den TAG der abgeschlossenen Anmeldung fest.
   *
   * Aufgerufen genau dort, wo eine Sitzung tatsächlich ausgestellt wird — nicht
   * schon nach dem Passwort, denn ein bei Faktor zwei abgebrochener Versuch ist
   * keine Anmeldung.
   *
   * `updateMany` statt `update`: fehlt die Zeile (gelöschte Person, Rennen mit
   * der Verwaltung), soll das keine erfolgreiche Anmeldung nachträglich
   * scheitern lassen. Der Wert ist eine Betriebskennzahl, kein Nachweis.
   *
   * UND ER DARF DIE ANMELDUNG NIEMALS SCHEITERN LASSEN ([W6]): Der Aufruf
   * steht zwischen der Ausstellung des Tokens und dem Setzen des Cookies.
   * Wirft er, bekäme eine korrekt authentifizierte Person einen 500 UND kein
   * Cookie — sie wäre ausgesperrt, weil eine Betriebszahl nicht geschrieben
   * werden konnte. Das ist der falsche Tausch: Die Kennzahl fehlt dann für
   * einen Tag, und das ist folgenlos.
   *
   * Bewusst anders als beim Audit-Log: Dort scheitert die Aktion mit dem
   * Nachweis, weil eine nicht protokollierte Aktion nicht als erfolgreich
   * gelten darf. Hier gibt es keinen Nachweis, nur eine Zahl.
   */
  async merkeAnmeldung(personId: string): Promise<void> {
    try {
      await this.prisma.person.updateMany({
        where: { id: personId },
        data: { letzteAnmeldungAm: zuDatum(heute()) },
      });
    } catch (ausnahme) {
      const grund = ausnahme instanceof Error ? ausnahme.message : String(ausnahme);
      this.logger.error(
        `Der Anmeldezeitpunkt von ${personId} konnte nicht festgehalten ` +
          `werden: ${grund}. Die Anmeldung selbst ist davon unberührt.`,
      );
    }
  }

  /** Kurzlebiges Token für den ausstehenden 2FA-Schritt beim Login (10 Min). */
  async erstellePending2faToken(personId: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: personId, pending2fa: true },
      { secret: this.config.get<string>('JWT_SECRET'), expiresIn: '10m' },
    );
  }

  /** Verifiziert das Pending-2FA-Token und gibt die personId zurück. */
  async verifizierePending2fa(token: string | undefined): Promise<string> {
    if (!token) throw new UnauthorizedException('Anmeldung fehlgeschlagen.');
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; pending2fa?: boolean }>(
        token,
        { secret: this.config.get<string>('JWT_SECRET') },
      );
      if (!payload.pending2fa) throw new Error('kein 2fa-token');
      return payload.sub;
    } catch {
      throw new UnauthorizedException('Anmeldung fehlgeschlagen.');
    }
  }

  /** Lädt eine aktive Person als SitzungsPerson (für den 2FA-Abschluss). */
  async ladeSitzungsPerson(personId: string): Promise<SitzungsPerson> {
    const person = await this.prisma.person.findUnique({ where: { id: personId } });
    if (!person || !person.aktiv) {
      throw new UnauthorizedException('Anmeldung fehlgeschlagen.');
    }
    return this.zuSitzungsPerson(person);
  }

  /** Aktuelle Person inkl. Domänen/Domänen und gültiger Funktionsrollen. */
  async ich(personId: string): Promise<AktuellePersonDTO> {
    const person = await this.prisma.person.findUnique({
      where: { id: personId },
      include: {
        organisation: { select: { name: true } },
        mitgliedschaften: {
          where: { gueltigBis: null },
          include: { domaene: true },
        },
        rollen: {
          where: { gueltigBis: null },
        },
      },
    });

    if (!person) {
      throw new UnauthorizedException('Konto nicht gefunden.');
    }

    const domaenen = person.mitgliedschaften.map((m) => ({
      domaeneId: m.domaene.id,
      name: m.domaene.name,
      rollen: person.rollen
        .filter((r) => r.domaeneId === m.domaene.id)
        .map((r) => r.rolleTyp as RolleTyp),
    }));

    return {
      id: person.id,
      name: person.name,
      displayName: person.displayName,
      nutzername: person.nutzername,
      loginEmail: person.loginEmail,
      istAdmin: person.istAdmin,
      benachrichtigungenAktiv: person.benachrichtigungenAktiv,
      avatarUrl: person.avatarUrl,
      avatarColor: person.avatarColor,
      avatarTextColor: person.avatarTextColor,
      zweiFaktorAktiv: person.zweiFaktorAktiv,
      angelegtAm: datumStringAusDate(person.angelegtAm),
      passwortGeaendertAm: person.passwortGeaendertAm
        ? datumStringAusDate(person.passwortGeaendertAm)
        : null,
      organisationName: person.organisation.name,
      domaenen,
    };
  }

  /**
   * Die Person zu einer E-Mail-Adresse — OHNE Rücksicht auf Groß- und
   * Kleinschreibung (12.09.2026).
   *
   * Vorher wurde exakt verglichen: Wer „Samuel@…" eintippte, obwohl
   * „samuel@…" gespeichert war, bekam weder eine Anmeldung noch eine Mail —
   * und wegen der neutralen Antwort auch keinen Hinweis darauf.
   *
   * `lower()` IN SQL, NICHT Prismas `mode: 'insensitive'`: Das erzeugt ein
   * `ILIKE`, und dort ist `_` ein Platzhalter — „max_muster@…" träfe auch
   * „maxXmuster@…". Die Eingabe geht als Parameter hinein, nie als SQL-Text.
   *
   * Die gespeicherten Adressen bleiben, wie sie sind. Gibt es zwei Konten,
   * die sich nur in der Schreibweise unterscheiden (die Eindeutigkeit in der
   * Datenbank unterscheidet Groß und Klein), gewinnt die exakte Schreibweise;
   * passt keine exakt, wird KEINS gewählt — lieber keine Mail als eine an die
   * falsche Person.
   */
  private async personIdPerEmail(email: string): Promise<string | null> {
    const eingabe = email.trim();
    if (eingabe === '') return null;
    const treffer = await this.prisma.$queryRaw<{ id: string; loginEmail: string }[]>`
      SELECT "id", "loginEmail" FROM "Person" WHERE lower("loginEmail") = lower(${eingabe})`;
    if (treffer.length === 1) return treffer[0].id;
    return treffer.find((t) => t.loginEmail === eingabe)?.id ?? null;
  }

  /**
   * Passwort-vergessen. Antwortet IMMER neutral (der Aufrufer gibt eine
   * einheitliche Meldung zurück). Nur bei existierendem Konto wird ein Token
   * erzeugt, dessen HASH gespeichert und eine Mail verschickt.
   */
  async passwortVergessen(email: string): Promise<void> {
    const id = await this.personIdPerEmail(email);
    const person =
      id === null ? null : await this.prisma.person.findUnique({ where: { id } });
    if (!person || !person.aktiv) {
      return;
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);

    await this.prisma.passwortReset.create({
      data: {
        personId: person.id,
        tokenHash,
        // Nur-Datum: gültig bis Ende des Folgetages (bewusst grob, keine Uhrzeit).
        laeuftAbAm: zuDatum(datumPlusTage(heute(), 1)),
      },
    });

    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:5173');
    const resetUrl = `${appUrl}/passwort-zuruecksetzen?token=${token}`;
    await this.mail.sendePasswortReset(person.loginEmail, resetUrl);
  }

  /**
   * Setzt das Passwort per Token zurück. Prüft Hash, Ablauf und erzwingt
   * Einmalgebrauch (atomar über updateMany mit eingeloestAm-Bedingung).
   */
  async passwortZuruecksetzen(
    token: string,
    neuesPasswort: string,
  ): Promise<void> {
    const ungueltig = new BadRequestException(
      'Der Link ist ungültig, abgelaufen oder wurde bereits verwendet.',
    );

    const tokenHash = this.hashToken(token);
    const reset = await this.prisma.passwortReset.findFirst({
      where: { tokenHash, eingeloestAm: null },
    });
    if (!reset) {
      throw ungueltig;
    }

    // Ablauf rein datumsbasiert prüfen: gültig, solange heute <= laeuftAbAm.
    if (zuDatum(heute()).getTime() > reset.laeuftAbAm.getTime()) {
      throw ungueltig;
    }

    // Einmalgebrauch atomar erzwingen.
    const markiert = await this.prisma.passwortReset.updateMany({
      where: { id: reset.id, eingeloestAm: null },
      data: { eingeloestAm: zuDatum(heute()) },
    });
    if (markiert.count === 0) {
      throw ungueltig;
    }

    const passwortHash = await argon2.hash(neuesPasswort, {
      type: argon2.argon2id,
    });
    await this.prisma.person.update({
      where: { id: reset.personId },
      data: {
        passwortHash,
        passwortGeaendertAm: zuDatum(heute()),
        // Alle bestehenden Sitzungen beenden. Der haeufigste Grund für einen
        // Reset ist der Verdacht, dass jemand Fremdes Zugriff hat — der bliebe
        // sonst bis zu sieben Tage angemeldet, trotz neuem Passwort.
        sitzungsGeneration: { increment: 1 },
        // Und die Anmeldesperre aufheben. Wer den Reset-Link benutzt hat, hat
        // den Besitz des Postfachs nachgewiesen. Ohne diese Zeile bliebe das
        // Opfer eines Aussperr-Angriffs nach dem Zuruecksetzen weitere 15
        // Minuten draussen — und erfuehre nicht einmal, warum, weil gesperrt
        // und falsches Passwort bewusst gleich beantwortet werden.
        fehlversuche: 0,
        gesperrtBis: null,
      },
    });
  }
}
