import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { heute, datumAusString, datumPlusTage } from '@soziolog/shared';
import { SitzungGuard } from '../common/guards/sitzung.guard';
import { GueltigkeitService } from './gueltigkeit.service';

/** Validiert einen optionalen YYYY-MM-DD-Query-Parameter (Format + Kalendertag). */
function pruefeDatum(wert: string | undefined, name: string): string | undefined {
  if (wert === undefined) return undefined;
  try {
    return datumAusString(wert);
  } catch {
    throw new BadRequestException(`${name} muss ein gültiges Datum (YYYY-MM-DD) sein.`);
  }
}

@Controller()
@UseGuards(SitzungGuard)
export class ZeitController {
  constructor(private readonly gueltigkeit: GueltigkeitService) {}

  @Get('domaenen/:domaeneId/stand')
  standDomaene(
    @Param('domaeneId') domaeneId: string,
    @Query('stichtag') stichtag?: string,
  ) {
    return this.gueltigkeit.standFuerDomaene(
      domaeneId,
      pruefeDatum(stichtag, 'stichtag') ?? heute(),
    );
  }

  @Get('stand')
  stand(@Query('stichtag') stichtag?: string) {
    return this.gueltigkeit.standAlle(pruefeDatum(stichtag, 'stichtag') ?? heute());
  }

  @Get('gesamt-log')
  gesamtLog(@Query('von') von?: string, @Query('bis') bis?: string) {
    const bisD = pruefeDatum(bis, 'bis') ?? heute();
    const vonD = pruefeDatum(von, 'von') ?? datumPlusTage(bisD, -365);
    return this.gueltigkeit.gesamtLog(vonD, bisD);
  }

  @Get('ueberpruefungen/faellig')
  faellig(@Query('stichtag') stichtag?: string) {
    return this.gueltigkeit.faelligeUeberpruefungen(
      pruefeDatum(stichtag, 'stichtag') ?? heute(),
    );
  }
}
