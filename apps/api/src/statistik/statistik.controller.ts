import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SitzungGuard } from '../common/guards/sitzung.guard';
import type { SitzungsPerson } from '../common/guards/sitzung.guard';
import { AktuellePerson } from '../common/decorators/aktuelle-person.decorator';
import { StatistikService } from './statistik.service';

/** Statistik-Auswertungen – lesbar für jede angemeldete, aktive Person. */
@Controller('statistik')
@UseGuards(SitzungGuard)
export class StatistikController {
  constructor(private readonly statistik: StatistikService) {}

  @Get('nutzer-pro-domaene')
  nutzerProDomaene(@AktuellePerson() person: SitzungsPerson) {
    return this.statistik.nutzerProDomaene(person.organisationId);
  }

  @Get('bedenken-pro-monat')
  bedenkenProMonat(
    @AktuellePerson() person: SitzungsPerson,
    @Query('domaeneId') domaeneId?: string,
  ) {
    return this.statistik.bedenkenProMonat(
      person.organisationId,
      domaeneId || undefined,
    );
  }

  @Get('domaene-einwaende-bedenken')
  domaeneEinwaendeBedenken(@AktuellePerson() person: SitzungsPerson) {
    return this.statistik.domaeneEinwaendeBedenken(person.organisationId);
  }

  @Get('domaene-entscheidungen')
  domaeneEntscheidungen(@AktuellePerson() person: SitzungsPerson) {
    return this.statistik.domaeneEntscheidungen(person.organisationId);
  }
}
