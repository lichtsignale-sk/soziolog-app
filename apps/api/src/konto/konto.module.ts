import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { KontoController } from './konto.controller';
import { KontoService } from './konto.service';
import { SitzungGuard } from '../common/guards/sitzung.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  // AuthModule wegen erstelleSitzungsToken: Der Passwortwechsel entwertet
  // alle Sitzungen und muss der handelnden Person sofort eine neue ausstellen.
  imports: [JwtModule.register({}), AuthModule],
  controllers: [KontoController],
  providers: [KontoService, SitzungGuard],
})
export class KontoModule {}
