import { Module } from '@nestjs/common';
import { KonfigModule } from '../konfig/konfig.module';
import { MailModule } from '../mail/mail.module';
import { SetupController } from './setup.controller';
import { SetupService } from './setup.service';
import { SetupGesperrtGuard } from './setup-gesperrt.guard';
import { SetupTokenGuard } from './setup-token.guard';
import { EinladungController } from '../einladung/einladung.controller';
import { DomaeneService } from '../verwaltung/domaene.service';
import { PersonVerwaltungService } from '../verwaltung/person-verwaltung.service';
import { EinladungService } from '../verwaltung/einladung.service';

@Module({
  imports: [KonfigModule, MailModule],
  controllers: [SetupController, EinladungController],
  providers: [
    SetupService,
    SetupGesperrtGuard,
    SetupTokenGuard,
    DomaeneService,
    PersonVerwaltungService,
    EinladungService,
  ],
})
export class SetupModule {}
