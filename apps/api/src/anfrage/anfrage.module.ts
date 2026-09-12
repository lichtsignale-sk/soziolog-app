import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { AnfrageController } from './anfrage.controller';
import { AnfrageService } from './anfrage.service';

/**
 * Die beiden Endpunkte sind STILLGELEGT (siehe `AnfrageController`); der
 * `AnfrageService` bleibt trotzdem eingetragen. Er ist die Vorlage für den
 * neuen Weg in `apps/control` und wird nicht gelöscht, solange der Umzug nicht
 * überall vollzogen ist.
 */
@Module({
  imports: [MailModule],
  controllers: [AnfrageController],
  providers: [AnfrageService],
})
export class AnfrageModule {}
