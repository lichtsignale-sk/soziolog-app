import {
  ConflictException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { KonfigService } from '../konfig/konfig.service';
import { MailService } from '../mail/mail.service';
import { DomaeneService } from '../verwaltung/domaene.service';
import { PersonVerwaltungService } from '../verwaltung/person-verwaltung.service';
import { EinladungService } from '../verwaltung/einladung.service';
import type { SetupDto, StartpersonDto } from './dto/setup.dto';

@Injectable()
export class SetupService {
  private readonly logger = new Logger(SetupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly konfig: KonfigService,
    private readonly mail: MailService,
    private readonly domaenen: DomaeneService,
    private readonly personen: PersonVerwaltungService,
    private readonly einladung: EinladungService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Setup nötig, wenn keine Organisation existiert oder Setup nicht abgeschlossen.
   * `smtpVorhanden` sagt dem Assistenten, ob bereits ein SMTP-Relay per Env
   * (SMTP_HOST) hinterlegt ist – dann überspringt er den SMTP-Schritt.
   */
  async status(): Promise<{
    benoetigtSetup: boolean;
    smtpVorhanden: boolean;
    demoModus: boolean;
  }> {
    const org = await this.prisma.organisation.findFirst({
      select: { setupAbgeschlossen: true },
    });
    const smtpVorhanden = Boolean(this.config.get<string>('SMTP_HOST'));
    const demoModus = this.config.get<string>('DEMO_MODE') === '1';
    return {
      benoetigtSetup: !org || !org.setupAbgeschlossen,
      smtpVorhanden,
      demoModus,
    };
  }

  /** Bildet aus einem Namen einen eindeutigen Nutzernamen (innerhalb des Batches). */
  private nutzernameAus(name: string, vergeben: Set<string>): string {
    const basis =
      name
        .toLowerCase()
        .replace(/ä/g, 'ae')
        .replace(/ö/g, 'oe')
        .replace(/ü/g, 'ue')
        .replace(/ß/g, 'ss')
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '.')
        .replace(/^\.+|\.+$/g, '')
        .slice(0, 30) || 'person';
    let kandidat = basis;
    let n = 1;
    while (vergeben.has(kandidat)) {
      kandidat = `${basis}${++n}`;
    }
    vergeben.add(kandidat);
    return kandidat;
  }

  /** Stellt sicher, dass genau je eine admin/moderation/teilhabender-Rolle vorkommt. */
  private pruefeRollen(personen: StartpersonDto[]): void {
    const rollen = personen.map((p) => p.rolle);
    const emails = personen.map((p) => p.email.toLowerCase());
    for (const erwartet of ['admin', 'moderation', 'teilhabender'] as const) {
      if (rollen.filter((r) => r === erwartet).length !== 1) {
        throw new UnprocessableEntityException(
          'Es muss genau je eine Person mit den Rollen admin, moderation und teilhabender geben.',
        );
      }
    }
    if (new Set(emails).size !== emails.length) {
      throw new UnprocessableEntityException(
        'Die E-Mail-Adressen der Startpersonen müssen unterschiedlich sein.',
      );
    }
  }

  /**
   * Führt den Erst-Setup durch. Kern (SMTP, Organisation, Domäne, Personen,
   * Einladungen) läuft in EINER Serializable-Transaktion (idempotent; kein
   * zweites Anlegen bei Nebenläufigkeit). Der E-Mail-Versand ist entkoppelt:
   * ein Versandfehler bricht das Setup nicht ab.
   */
  async durchfuehren(dto: SetupDto): Promise<{
    erstellt: true;
    versandFehler: string[];
  }> {
    if (await this.prisma.organisation.findFirst({ select: { id: true } })) {
      throw new GoneException('Der Setup ist bereits abgeschlossen.');
    }
    this.pruefeRollen(dto.startpersonen);

    const erstellt = await this.prisma.$transaction(
      async (tx) => {
        // Re-Check innerhalb der Transaktion (Serializable) gegen Doppelanlage.
        if ((await tx.organisation.count()) > 0) {
          throw new ConflictException('Der Setup läuft bereits.');
        }

        // SMTP nur speichern, wenn im Assistenten angegeben. Fehlt es (weil der
        // Server bereits ein Env-Relay hat), bleibt die verschlüsselte Konfig
        // leer und der Versand fällt auf die Env-Variablen SMTP_* zurück.
        if (dto.smtp) {
          await this.konfig.setzeSmtp(
            {
              host: dto.smtp.host,
              port: dto.smtp.port,
              user: dto.smtp.user,
              passwort: dto.smtp.passwort,
              absender: dto.smtp.absender,
            },
            tx,
          );
        }

        const org = await tx.organisation.create({
          data: { name: dto.organisationName, setupAbgeschlossen: false },
        });

        const vergeben = new Set<string>();
        const angelegte: {
          personId: string;
          name: string;
          email: string;
          rolle: string;
          token: string;
        }[] = [];
        for (const sp of dto.startpersonen) {
          const { person, einladungToken } = await this.personen.anlegen(
            org.id,
            {
              name: sp.name,
              nutzername: this.nutzernameAus(sp.name, vergeben),
              loginEmail: sp.email,
              istAdmin: sp.rolle === 'admin',
            },
            tx,
          );
          angelegte.push({
            personId: person.id,
            name: sp.name,
            email: sp.email,
            rolle: sp.rolle,
            token: einladungToken,
          });
        }

        // Besetzung der Haupt-Domäne: admin -> Logbuchführer, moderation ->
        // Moderation, dritte Person -> nur Teilhabender. Erfüllt Gründungsregel a.
        // Genau eine Funktionsrolle pro Person.
        const besetzung = angelegte.map((a) => ({
          personId: a.personId,
          rolleTyp:
            a.rolle === 'admin'
              ? ('logbuchfuehrer' as const)
              : a.rolle === 'moderation'
                ? ('moderation' as const)
                : undefined,
        }));

        await this.domaenen.erstellenMit(tx, org.id, {
          name: dto.hauptdomaene.name,
          ziel: dto.hauptdomaene.ziel,
          tasks: dto.hauptdomaene.tasks,
          besetzung,
        });

        await tx.organisation.update({
          where: { id: org.id },
          data: { setupAbgeschlossen: true },
        });

        return angelegte;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    // Entkoppelter Versand: Fehler auffangen, protokollieren (ohne Token), sammeln.
    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:5173');
    const versandFehler: string[] = [];
    for (const p of erstellt) {
      try {
        await this.mail.sendeEinladung(
          p.email,
          p.name,
          `${appUrl}/einladung/${p.token}`,
        );
      } catch (e) {
        versandFehler.push(p.personId);
        this.logger.error(
          `Einladungs-Mail an ${p.email} fehlgeschlagen: ${(e as Error).message}`,
        );
      }
    }

    return { erstellt: true, versandFehler };
  }
}
