import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { KonfigModule } from '../konfig/konfig.module';

@Module({
  imports: [KonfigModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
