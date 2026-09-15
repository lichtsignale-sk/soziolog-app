import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SitzungGuard } from '../common/guards/sitzung.guard';
import { MailModule } from '../mail/mail.module';
import { FeedbackController } from './feedback.controller';
import { FeedbackSchalterService } from './feedback-schalter.service';
import { FeedbackService } from './feedback.service';

/**
 * Feedback aus der App per Mail. Aktiv nur mit `FEEDBACK_EMPFAENGER`; mit
 * `FEEDBACK_SCHALTER_URL` zusätzlich von außen abschaltbar (docs/08-deployment.md).
 */
@Module({
  imports: [JwtModule.register({}), MailModule],
  controllers: [FeedbackController],
  providers: [FeedbackService, FeedbackSchalterService, SitzungGuard],
})
export class FeedbackModule {}
