import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Global, damit jeder Service PrismaService injizieren kann,
 * ohne PrismaModule einzeln zu importieren.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
