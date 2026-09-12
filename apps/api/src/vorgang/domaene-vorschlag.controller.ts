import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SitzungGuard } from '../common/guards/sitzung.guard';
import type { SitzungsPerson } from '../common/guards/sitzung.guard';
import { ProtokollfuehrerGuard } from '../common/guards/protokollfuehrer.guard';
import { AktuellePerson } from '../common/decorators/aktuelle-person.decorator';
import { VorgangService } from './vorgang.service';
import { VorschlagErstellenDto } from './dto/vorschlag.dto';

@Controller('domaenen')
export class DomaeneVorschlagController {
  constructor(private readonly vorgang: VorgangService) {}

  @Post(':domaeneId/vorschlaege')
  @UseGuards(SitzungGuard, ProtokollfuehrerGuard)
  erstellen(
    @AktuellePerson() person: SitzungsPerson,
    @Param('domaeneId') domaeneId: string,
    @Body() dto: VorschlagErstellenDto,
  ) {
    return this.vorgang.erstelleVorschlag(person.id, domaeneId, dto);
  }

  @Get(':domaeneId/vorschlaege')
  @UseGuards(SitzungGuard)
  liste(@Param('domaeneId') domaeneId: string) {
    return this.vorgang.holeVorschlaegeFuerDomaene(domaeneId);
  }
}
