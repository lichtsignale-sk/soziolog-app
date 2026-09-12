import {
  CanActivate,
  ExecutionContext,
  GoneException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Sperrt Setup-Endpunkte, sobald eine Organisation mit abgeschlossenem Setup
 * existiert (410 Gone). Verhindert erneutes Durchführen des Erst-Setups.
 */
@Injectable()
export class SetupGesperrtGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(_context: ExecutionContext): Promise<boolean> {
    const org = await this.prisma.organisation.findFirst({
      where: { setupAbgeschlossen: true },
      select: { id: true },
    });
    if (org) {
      throw new GoneException('Der Setup ist bereits abgeschlossen.');
    }
    return true;
  }
}
