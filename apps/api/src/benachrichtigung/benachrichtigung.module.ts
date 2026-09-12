import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MailModule } from '../mail/mail.module';
import { GueltigkeitModule } from '../gueltigkeit/gueltigkeit.module';
import { SitzungGuard } from '../common/guards/sitzung.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { BenachrichtigungController } from './benachrichtigung.controller';
import { BenachrichtigungService } from './benachrichtigung.service';
import { UeberpruefungScheduler } from './ueberpruefung.scheduler';

@Module({
  imports: [JwtModule.register({}), MailModule, GueltigkeitModule],
  controllers: [BenachrichtigungController],
  providers: [
    BenachrichtigungService,
    UeberpruefungScheduler,
    SitzungGuard,
    AdminGuard,
  ],
  exports: [BenachrichtigungService],
})
export class BenachrichtigungModule {}
