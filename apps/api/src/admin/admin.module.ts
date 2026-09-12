import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RechteModule } from '../rechte/rechte.module';
import { MailModule } from '../mail/mail.module';
import { AdminPersonenController } from './admin-personen.controller';
import { AdminDomaenenController } from './admin-domaenen.controller';
import { SitzungGuard } from '../common/guards/sitzung.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { ProtokollfuehrerGuard } from '../common/guards/protokollfuehrer.guard';
import { EinladungService } from '../verwaltung/einladung.service';
import { PersonVerwaltungService } from '../verwaltung/person-verwaltung.service';
import { DomaeneService } from '../verwaltung/domaene.service';
import { MitgliedschaftService } from '../verwaltung/mitgliedschaft.service';
import { RollenService } from '../verwaltung/rollen.service';
import { DomaeneArchivService } from '../verwaltung/domaene-archiv.service';

@Module({
  imports: [JwtModule.register({}), RechteModule, MailModule],
  controllers: [AdminPersonenController, AdminDomaenenController],
  providers: [
    SitzungGuard,
    AdminGuard,
    ProtokollfuehrerGuard,
    EinladungService,
    PersonVerwaltungService,
    DomaeneService,
    MitgliedschaftService,
    RollenService,
    DomaeneArchivService,
  ],
  exports: [
    EinladungService,
    PersonVerwaltungService,
    DomaeneService,
    MitgliedschaftService,
    RollenService,
    DomaeneArchivService,
  ],
})
export class AdminModule {}
