import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RechteModule } from '../rechte/rechte.module';
import { GueltigkeitService } from './gueltigkeit.service';
import { BeschlussController } from './beschluss.controller';
import { ZeitController } from './zeit.controller';
import { SitzungGuard } from '../common/guards/sitzung.guard';
import { BeschlussSchreibGuard } from '../common/guards/beschluss-schreib.guard';

@Module({
  imports: [JwtModule.register({}), RechteModule],
  controllers: [BeschlussController, ZeitController],
  providers: [GueltigkeitService, SitzungGuard, BeschlussSchreibGuard],
  exports: [GueltigkeitService],
})
export class GueltigkeitModule {}
