import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SitzungGuard } from '../common/guards/sitzung.guard';
import type { SitzungsPerson } from '../common/guards/sitzung.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { AktuellePerson } from '../common/decorators/aktuelle-person.decorator';
import { KorrekturService } from './korrektur.service';
import { KorrekturAntragGuard } from './korrektur-antrag.guard';
import { KorrekturAntragDto, KorrekturAblehnenDto } from './dto/korrektur.dto';

@Controller('korrekturen')
export class KorrekturController {
  constructor(private readonly korrektur: KorrekturService) {}

  /** Antrag stellen: nur Protokollführer des betroffenen Domäne (Admin-Bypass). */
  @Post()
  @HttpCode(201)
  @UseGuards(SitzungGuard, KorrekturAntragGuard)
  async stellen(
    @AktuellePerson() person: SitzungsPerson,
    @Body() dto: KorrekturAntragDto,
  ) {
    return this.korrektur.antragStellen(person.id, person.organisationId, dto);
  }

  /** Offene Anträge (Admin-Queue). */
  @Get()
  @UseGuards(SitzungGuard, AdminGuard)
  offene(
    @AktuellePerson() person: SitzungsPerson,
    @Query('status') _status?: string,
  ) {
    return this.korrektur.offeneAntraege(person.organisationId);
  }

  @Post(':id/bestaetigen')
  @HttpCode(200)
  @UseGuards(SitzungGuard, AdminGuard)
  async bestaetigen(
    @AktuellePerson() person: SitzungsPerson,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    await this.korrektur.bestaetigen(id, person.id);
    return { ok: true };
  }

  @Post(':id/ablehnen')
  @HttpCode(200)
  @UseGuards(SitzungGuard, AdminGuard)
  async ablehnen(
    @AktuellePerson() person: SitzungsPerson,
    @Param('id') id: string,
    @Body() dto: KorrekturAblehnenDto,
  ): Promise<{ ok: true }> {
    await this.korrektur.ablehnen(id, person.id, dto.grund);
    return { ok: true };
  }
}
