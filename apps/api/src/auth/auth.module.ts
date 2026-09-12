import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ZweiFaktorController } from './zwei-faktor.controller';
import { ZweiFaktorService } from './zwei-faktor.service';
import { MailModule } from '../mail/mail.module';
import { SitzungGuard } from '../common/guards/sitzung.guard';

@Module({
  imports: [JwtModule.register({}), MailModule],
  controllers: [AuthController, ZweiFaktorController],
  providers: [AuthService, ZweiFaktorService, SitzungGuard],
  exports: [AuthService],
})
export class AuthModule {}
