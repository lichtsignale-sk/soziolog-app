import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { SitzungGuard } from '../common/guards/sitzung.guard';
import type { SitzungsPerson } from '../common/guards/sitzung.guard';
import { AktuellePerson } from '../common/decorators/aktuelle-person.decorator';
import { DomaeneLeseService } from './domaene-lese.service';

/** Lesen für jede angemeldete, aktive Person (keine Domänengrenze). */
@Controller('domaenen')
@UseGuards(SitzungGuard)
export class DomaeneLeseController {
  constructor(private readonly domaenen: DomaeneLeseService) {}

  @Get()
  alle(@AktuellePerson() person: SitzungsPerson) {
    return this.domaenen.alleDomaenen(person.organisationId);
  }

  @Get(':id')
  einer(@AktuellePerson() person: SitzungsPerson, @Param('id') id: string) {
    return this.domaenen.domaeneDetail(person.organisationId, id);
  }

  @Get(':id/mitglieder')
  mitglieder(@AktuellePerson() person: SitzungsPerson, @Param('id') id: string) {
    return this.domaenen.mitgliederDesDomaene(person.organisationId, id);
  }
}
