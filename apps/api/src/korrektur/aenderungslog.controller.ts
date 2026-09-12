import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SitzungGuard } from '../common/guards/sitzung.guard';
import type { SitzungsPerson } from '../common/guards/sitzung.guard';
import { AktuellePerson } from '../common/decorators/aktuelle-person.decorator';
import { KorrekturService } from './korrektur.service';

/** Änderungslog – lesbar für jede angemeldete, aktive Person. */
@Controller('aenderungslog')
@UseGuards(SitzungGuard)
export class AenderungslogController {
  constructor(private readonly korrektur: KorrekturService) {}

  /**
   * Standardmäßig die bestätigten Korrekturen; mit ?status=abgelehnt die
   * abgelehnten (mit Begründung). Jeder andere Wert fällt auf 'bestaetigt' zurück.
   */
  @Get()
  alle(
    @AktuellePerson() person: SitzungsPerson,
    @Query('status') status?: string,
  ) {
    const gefiltert = status === 'abgelehnt' ? 'abgelehnt' : 'bestaetigt';
    return this.korrektur.aenderungslog(person.organisationId, gefiltert);
  }
}
