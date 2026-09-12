import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RechteModule } from '../rechte/rechte.module';
import { BenachrichtigungModule } from '../benachrichtigung/benachrichtigung.module';
import { SitzungGuard } from '../common/guards/sitzung.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { KorrekturController } from './korrektur.controller';
import { AenderungslogController } from './aenderungslog.controller';
import { KorrekturService } from './korrektur.service';
import { KorrekturAntragGuard } from './korrektur-antrag.guard';

@Module({
  imports: [JwtModule.register({}), RechteModule, BenachrichtigungModule],
  controllers: [KorrekturController, AenderungslogController],
  providers: [KorrekturService, SitzungGuard, AdminGuard, KorrekturAntragGuard],
})
export class KorrekturModule {}
