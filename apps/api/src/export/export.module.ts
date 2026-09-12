import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { VorgangModule } from '../vorgang/vorgang.module';
import { DomaeneModule } from '../domaene/domaene.module';
import { MailModule } from '../mail/mail.module';
import { SitzungGuard } from '../common/guards/sitzung.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';
import { ExportAggregatorService } from './export-aggregator.service';

@Module({
  imports: [JwtModule.register({}), VorgangModule, DomaeneModule, MailModule],
  controllers: [ExportController],
  providers: [ExportService, ExportAggregatorService, SitzungGuard, AdminGuard],
})
export class ExportModule {}
