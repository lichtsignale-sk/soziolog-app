import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AktuellePerson } from '../common/decorators/aktuelle-person.decorator';
import { SitzungGuard } from '../common/guards/sitzung.guard';
import type { SitzungsPerson } from '../common/guards/sitzung.guard';
import { FeedbackDto } from './dto/feedback.dto';
import { FeedbackService, type FeedbackStatus } from './feedback.service';

/**
 * Feedback aus der App. Nur angemeldet; der POST läuft zusätzlich durch die
 * globale CSRF-Prüfung.
 */
@Controller('feedback')
@UseGuards(SitzungGuard)
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  /** Ob der Punkt „Feedback geben" erscheinen soll. */
  @Get('status')
  async status(): Promise<FeedbackStatus> {
    return this.feedback.status();
  }

  @Post()
  @HttpCode(204)
  // Drei in zehn Minuten je Adresse — genug für Menschen, die nachschieben,
  // und zu wenig, als dass eine Adresse allein die Stunden-Obergrenze der
  // Instanz (30) aufbrauchen könnte.
  @Throttle({ default: { limit: 3, ttl: 600_000 } })
  async sende(
    @AktuellePerson() person: SitzungsPerson,
    @Body() dto: FeedbackDto,
  ): Promise<void> {
    await this.feedback.sende(person, dto);
  }
}
