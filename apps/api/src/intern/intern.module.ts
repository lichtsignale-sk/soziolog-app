import { Module } from '@nestjs/common';
import { KennzahlenController } from './kennzahlen.controller';
import { KennzahlenService } from './kennzahlen.service';

/**
 * Interner, maschinenlesbarer Zugang für den Betrieb: Ein Betreiber mehrerer
 * Instanzen kann damit zentral wenige Betriebskennzahlen abfragen.
 *
 * Enthält genau einen Endpunkt (`GET /api/intern/kennzahlen`) und ist ohne
 * gesetzte `KENNZAHLEN_TOKEN`-Variable wirkungslos.
 */
@Module({
  controllers: [KennzahlenController],
  providers: [KennzahlenService],
})
export class InternModule {}
