import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { KennzahlenTokenGuard } from './kennzahlen-token.guard';
import { KennzahlenService } from './kennzahlen.service';
import type { KennzahlenAntwort } from './kennzahlen.typen';

/**
 * `GET /api/intern/kennzahlen` — ein Betreiber mehrerer Instanzen kann damit
 * zentral abfragen, ob und wie eine laufende Instanz genutzt wird.
 *
 * WARUM ES DAS GIBT — und warum es so schmal ist: Eine zentrale Übersicht
 * braucht KEINE SQL-Verbindung zu den Datenbanken der Instanzen. Sie fragt
 * hier z. B. täglich sechs Werte ab, mehr existiert auf dieser Route nicht.
 * Genau das macht den Zugang in einem Satz erklärbar.
 *
 * SCHUTZ: ein PRO INSTANZ erzeugtes Geheimnis (`KENNZAHLEN_TOKEN`),
 * zeitkonstant verglichen. Ohne die Variable existiert die Route nicht (404) —
 * bestehende Instanzen bleiben unverändert.
 *
 * AUSSCHLIESSLICH LESEND. Es gibt hier keinen POST, PATCH oder DELETE, und es
 * soll auch keinen geben: Über diesen Zugang wird auf einer Instanz nichts
 * geschrieben.
 */
@Controller('intern')
@UseGuards(KennzahlenTokenGuard)
export class KennzahlenController {
  constructor(private readonly kennzahlen: KennzahlenService) {}

  @Get('kennzahlen')
  // Abgefragt wird einmal am Tag. Ein Limit von 30/Minute lässt Nachholläufe
  // und Fehlersuche zu und macht das Raten des Geheimnisses trotzdem teuer.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async abrufen(
    /**
     * Abdruck des Organisationsnamens, den der Abfragende erwartet — NICHT der
     * Name. Optional; ohne ihn bleibt
     * `organisationsnameStimmt` null.
     */
    @Query('nameAbdruck') nameAbdruck?: string,
  ): Promise<KennzahlenAntwort> {
    // Nur ein Hex-Abdruck kommt durch. Alles andere wird verworfen statt
    // durchgereicht: Ein freier Abfrageparameter wäre der einzige Weg, über
    // den auf diesem Endpunkt je Fremdtext ankäme.
    const geprueft =
      typeof nameAbdruck === 'string' && /^[0-9a-f]{64}$/.test(nameAbdruck)
        ? nameAbdruck
        : undefined;
    return this.kennzahlen.erhebe(geprueft);
  }
}
