import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SitzungGuard } from '../common/guards/sitzung.guard';
import type { SitzungsPerson } from '../common/guards/sitzung.guard';
import { VorschlagSchreibGuard } from '../common/guards/vorschlag-schreib.guard';
import { AktuellePerson } from '../common/decorators/aktuelle-person.decorator';
import { VorgangService } from './vorgang.service';
import { BedenkenErstellenDto } from './dto/bedenken.dto';
import { EinwandErstellenDto } from './dto/einwand.dto';
import { BeschlussErstellenDto } from './dto/beschluss.dto';

@Controller('vorschlaege')
export class VorschlagController {
  constructor(private readonly vorgang: VorgangService) {}

  @Get(':id')
  @UseGuards(SitzungGuard)
  einer(@Param('id') id: string) {
    return this.vorgang.holeVorschlag(id);
  }

  @Post(':id/bedenken')
  @UseGuards(SitzungGuard, VorschlagSchreibGuard)
  bedenken(
    @AktuellePerson() person: SitzungsPerson,
    @Param('id') id: string,
    @Body() dto: BedenkenErstellenDto,
  ) {
    return this.vorgang.fuegeBedenken(person.id, id, dto);
  }

  @Post(':id/einwaende')
  @UseGuards(SitzungGuard, VorschlagSchreibGuard)
  einwand(
    @AktuellePerson() person: SitzungsPerson,
    @Param('id') id: string,
    @Body() dto: EinwandErstellenDto,
  ) {
    return this.vorgang.fuegeEinwand(person.id, id, dto);
  }

  @Post(':id/beschluss')
  @UseGuards(SitzungGuard, VorschlagSchreibGuard)
  beschluss(
    @AktuellePerson() person: SitzungsPerson,
    @Param('id') id: string,
    @Body() dto: BeschlussErstellenDto,
  ) {
    return this.vorgang.erstelleBeschluss(person.id, id, dto);
  }
}
