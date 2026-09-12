import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { datumStringAusDate, organisationsnameAbdruck } from '@soziolog/shared';
import { PrismaService } from '../prisma/prisma.service';
import { APP_VERSION } from '../version';
import type { KennzahlenAntwort } from './kennzahlen.typen';

/**
 * ZÄHLT. MEHR NICHT.
 *
 * Jede Abfrage hier ist ein `count` oder ein `max` über ein Tagesdatum. Es
 * gibt in dieser Datei bewusst kein `findMany` mit `select` auf ein
 * Textfeld — der Datenvertrag (`kennzahlen.typen.ts`) und der Test
 * (`kennzahlen.spec.ts`) halten das fest, aber die einfachste Absicherung ist,
 * dass hier gar nichts anderes steht.
 *
 * ORGANISATIONSÜBERGREIFEND: Eine Instanz trägt genau eine Organisation.
 * Es gibt deshalb keinen `organisationId`-Filter — und damit auch keine
 * Möglichkeit, Zahlen einer bestimmten Organisation gezielt herauszugreifen.
 */
@Injectable()
export class KennzahlenService {
  private readonly logger = new Logger(KennzahlenService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * @param nameAbdruck Abdruck des Namens, den der Abfragende erwartet. Es ist
   *                    ausdrücklich NICHT der Name — siehe `kennzahlen.typen`.
   */
  async erhebe(nameAbdruck?: string): Promise<KennzahlenAntwort> {
    try {
      const [
        aktivePersonen,
        kreise,
        letzterEintragAm,
        letzteAnmeldungAm,
        organisationsnameStimmt,
      ] = await Promise.all([
        this.prisma.person.count({ where: { aktiv: true } }),
        this.prisma.domaene.count({
          where: { aktiv: true, archiviert: false },
        }),
        this.letzterEintragAm(),
        this.letzteAnmeldungAm(),
        this.nameStimmt(nameAbdruck),
      ]);

      return {
        datenbank: 'erreichbar',
        aktivePersonen,
        kreise,
        letzterEintragAm,
        letzteAnmeldungAm,
        appVersion: APP_VERSION,
        organisationsnameStimmt,
      };
    } catch (ausnahme) {
      // NICHT als 500 durchreichen: „App antwortet, Datenbank nicht" ist eine
      // andere Lage als „Instanz ist weg", und nur diese Antwort kann der
      // Abfragende unterscheiden. Der Grund bleibt im Log der Instanz, nicht in der
      // Antwort — er enthält je nach Treiber Verbindungszeichenketten.
      const grund = ausnahme instanceof Error ? ausnahme.message : String(ausnahme);
      this.logger.error(`Kennzahlen nicht erhebbar: ${grund}`);
      return {
        datenbank: 'gestoert',
        aktivePersonen: null,
        kreise: null,
        letzterEintragAm: null,
        letzteAnmeldungAm: null,
        appVersion: APP_VERSION,
        organisationsnameStimmt: null,
      };
    }
  }

  /**
   * Vergleicht den eigenen Organisationsnamen mit dem erwarteten ABDRUCK.
   *
   * Gibt `null`, wenn keine Erwartung mitkam oder keine Organisation existiert
   * (frische Instanz vor der Einrichtung). `null` heisst „nicht gemessen" und
   * ist etwas anderes als `false` — der Abfragende darf daraus keine
   * Abweichung machen.
   *
   * Der Name verlässt die Instanz dabei NICHT: Verglichen werden Abdrücke.
   */
  private async nameStimmt(erwarteterAbdruck?: string): Promise<boolean | null> {
    if (erwarteterAbdruck === undefined || erwarteterAbdruck.length === 0) {
      return null;
    }
    const organisation = await this.prisma.organisation.findFirst({
      select: { name: true },
      orderBy: { angelegtAm: 'asc' },
    });
    if (organisation === null) return null;
    return (
      organisationsnameAbdruck(organisation.name, (wert) =>
        createHash('sha256').update(wert, 'utf8').digest('hex'),
      ) === erwarteterAbdruck
    );
  }

  /**
   * Der jüngste Tag über ALLE vier Eintragsarten.
   *
   * Vier `aggregate`-Abfragen statt einer Vereinigung: Prisma kann das ohne
   * rohes SQL nicht in einem Zug, und vier Maxima über indizierte
   * Datumsspalten sind billig. Das Ergebnis ist ein Tag, kein Datensatz —
   * es verlässt die Instanz nichts, woraus sich ein Eintrag rekonstruieren
   * liesse.
   */
  private async letzterEintragAm(): Promise<string | null> {
    const [vorschlag, bedenken, einwand, beschluss] = await Promise.all([
      this.prisma.vorschlag.aggregate({ _max: { datum: true } }),
      this.prisma.bedenken.aggregate({ _max: { datum: true } }),
      this.prisma.einwand.aggregate({ _max: { datum: true } }),
      this.prisma.beschluss.aggregate({ _max: { datum: true } }),
    ]);
    return spaetester([
      vorschlag._max.datum,
      bedenken._max.datum,
      einwand._max.datum,
      beschluss._max.datum,
    ]);
  }

  private async letzteAnmeldungAm(): Promise<string | null> {
    const ergebnis = await this.prisma.person.aggregate({
      _max: { letzteAnmeldungAm: true },
    });
    return spaetester([ergebnis._max.letzteAnmeldungAm]);
  }
}

/** Der späteste von mehreren Tagen als `YYYY-MM-DD`; `null`, wenn keiner da ist. */
export function spaetester(tage: (Date | null)[]): string | null {
  const vorhandene = tage
    .filter((tag): tag is Date => tag !== null)
    .map(datumStringAusDate)
    .sort();
  return vorhandene.length === 0 ? null : vorhandene[vorhandene.length - 1];
}
