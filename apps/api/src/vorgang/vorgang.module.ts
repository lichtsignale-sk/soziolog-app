import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RechteModule } from '../rechte/rechte.module';
import { BenachrichtigungModule } from '../benachrichtigung/benachrichtigung.module';
import { DomaeneVorschlagController } from './domaene-vorschlag.controller';
import { VorschlagController } from './vorschlag.controller';
import { VorgangService } from './vorgang.service';
import { SitzungGuard } from '../common/guards/sitzung.guard';
import { ProtokollfuehrerGuard } from '../common/guards/protokollfuehrer.guard';
import { VorschlagSchreibGuard } from '../common/guards/vorschlag-schreib.guard';

@Module({
  imports: [JwtModule.register({}), RechteModule, BenachrichtigungModule],
  controllers: [DomaeneVorschlagController, VorschlagController],
  providers: [
    VorgangService,
    SitzungGuard,
    ProtokollfuehrerGuard,
    VorschlagSchreibGuard,
  ],
  exports: [VorgangService],
})
export class VorgangModule {}
