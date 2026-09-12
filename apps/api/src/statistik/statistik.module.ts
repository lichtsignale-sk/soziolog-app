import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { StatistikController } from './statistik.controller';
import { StatistikService } from './statistik.service';
import { SitzungGuard } from '../common/guards/sitzung.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [StatistikController],
  providers: [StatistikService, SitzungGuard],
})
export class StatistikModule {}
