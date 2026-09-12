import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DomaeneLeseController } from './domaene-lese.controller';
import { DomaeneLeseService } from './domaene-lese.service';
import { SitzungGuard } from '../common/guards/sitzung.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [DomaeneLeseController],
  providers: [DomaeneLeseService, SitzungGuard],
  exports: [DomaeneLeseService],
})
export class DomaeneModule {}
