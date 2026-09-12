import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { AnfrageController } from './anfrage.controller';
import { AnfrageService } from './anfrage.service';

/**
 * Die beiden Endpunkte sind STILLGELEGT (siehe `AnfrageController`); der
 * `AnfrageService` bleibt trotzdem eingetragen und wird vorerst nicht gelöscht.
 */
@Module({
  imports: [MailModule],
  controllers: [AnfrageController],
  providers: [AnfrageService],
})
export class AnfrageModule {}
