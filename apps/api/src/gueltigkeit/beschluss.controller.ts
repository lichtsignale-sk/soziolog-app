import { Body, Controller, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { SitzungGuard } from '../common/guards/sitzung.guard';
import { BeschlussSchreibGuard } from '../common/guards/beschluss-schreib.guard';
import { GueltigkeitService } from './gueltigkeit.service';
import { BeschlussBestaetigenDto } from './dto/beschluss-bestaetigen.dto';

@Controller('beschluesse')
export class BeschlussController {
  constructor(private readonly gueltigkeit: GueltigkeitService) {}

  @Post(':id/beenden')
  @HttpCode(200)
  @UseGuards(SitzungGuard, BeschlussSchreibGuard)
  async beenden(@Param('id') id: string): Promise<{ ok: true }> {
    await this.gueltigkeit.beendeBeschluss(id);
    return { ok: true };
  }

  /** Erneut bestätigen am Fristende – derselbe Beschluss, neue Befristung. */
  @Post(':id/bestaetigen')
  @HttpCode(200)
  @UseGuards(SitzungGuard, BeschlussSchreibGuard)
  async bestaetigen(
    @Param('id') id: string,
    @Body() dto: BeschlussBestaetigenDto,
  ): Promise<{ ok: true }> {
    await this.gueltigkeit.bestaetigeBeschluss(id, dto);
    return { ok: true };
  }
}
