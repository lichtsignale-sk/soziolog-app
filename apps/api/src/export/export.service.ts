import { Injectable, Logger } from '@nestjs/common';
import { heute } from '@soziolog/shared';
import type { SitzungsPerson } from '../common/guards/sitzung.guard';
import { PrismaService } from '../prisma/prisma.service';
import { DomaeneLeseService } from '../domaene/domaene-lese.service';
import { VorgangService } from '../vorgang/vorgang.service';
import { MailService } from '../mail/mail.service';
import { ExportAggregatorService } from './export-aggregator.service';
import {
  einzelDefinition,
  domaeneDefinition,
  organisationDefinition,
  rendere,
} from './pdf-renderer';

export interface PdfErgebnis {
  buffer: Buffer;
  dateiname: string;
}

/**
 * Erzeugt die PDF-Exporte. Wichtig: die Organisationsgrenze wird IMMER über
 * DomaeneLeseService.domaeneDetail(organisationId, …) geprüft (wirft NotFound bei
 * fremder Organisation) – VorgangService.holeVorschlag prüft sie selbst nicht.
 */
@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly domaenen: DomaeneLeseService,
    private readonly vorgang: VorgangService,
    private readonly aggregator: ExportAggregatorService,
    private readonly mail: MailService,
  ) {}

  /** Name der Organisation (für Fußzeile/Deckblatt der Exporte). */
  private async orgName(organisationId: string): Promise<string> {
    const org = await this.prisma.organisation.findUnique({
      where: { id: organisationId },
      select: { name: true },
    });
    return org?.name ?? 'Organisation';
  }

  /** Einzelner Beschluss/Vorgang als PDF (mit Org-Grenzprüfung). */
  async einzel(person: SitzungsPerson, vorschlagId: string): Promise<PdfErgebnis> {
    const vorschlag = await this.vorgang.holeVorschlag(vorschlagId);
    // Grenzprüfung: gehört die Domäne des Vorschlags zur Organisation der Person?
    const domaene = await this.domaenen.domaeneDetail(
      person.organisationId,
      vorschlag.domaeneId,
    );
    const orgName = await this.orgName(person.organisationId);
    const buffer = await rendere(einzelDefinition(vorschlag, domaene.name, orgName));
    return { buffer, dateiname: dateiname('beschluss', vorschlag.titel) };
  }

  /** Alle Vorgänge einer Domäne als PDF (mit Org-Grenzprüfung). */
  async domaene(person: SitzungsPerson, domaeneId: string): Promise<PdfErgebnis> {
    const domaene = await this.domaenen.domaeneDetail(person.organisationId, domaeneId);
    const vorschlaege = await this.vorgang.holeVorschlaegeFuerDomaene(domaeneId);
    const orgName = await this.orgName(person.organisationId);
    const buffer = await rendere(domaeneDefinition(domaene, vorschlaege, orgName));
    return { buffer, dateiname: dateiname('domaene', domaene.name) };
  }

  /**
   * Stößt den org-weiten Gesamt-Export an (fire-and-forget): PDF wird im
   * Hintergrund erzeugt und der anfragenden Person per Mail-Anhang zugestellt.
   * Ein Fehler bricht den Request nicht ab, sondern wird nur protokolliert.
   */
  organisationAnfragen(person: SitzungsPerson): void {
    void this.erzeugeUndSendeOrganisation(person).catch((e) =>
      this.logger.error(
        `Org-Export für ${person.loginEmail} fehlgeschlagen: ${(e as Error).message}`,
      ),
    );
  }

  private async erzeugeUndSendeOrganisation(person: SitzungsPerson): Promise<void> {
    const orgName = await this.orgName(person.organisationId);
    const gruppen = await this.aggregator.organisationVollstaendig(person.organisationId);
    const buffer = await rendere(
      organisationDefinition(orgName, person.name, gruppen),
    );
    await this.mail.sendeExportFertig(
      person.loginEmail,
      person.name,
      buffer,
      dateiname('organisation', orgName),
    );
    this.logger.log(`Org-Export an ${person.loginEmail} versandt (${gruppen.length} Domänen).`);
  }
}

/** Dateiname wie „beschluss-<slug>-JJJJ-MM-TT.pdf". */
function dateiname(prefix: string, titel: string): string {
  return `${prefix}-${slug(titel)}-${heute()}.pdf`;
}

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'export'
  );
}
