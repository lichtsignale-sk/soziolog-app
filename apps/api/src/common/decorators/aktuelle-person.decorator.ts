import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { SitzungsPerson } from '../guards/sitzung.guard';

/**
 * Liefert die vom SitzungGuard angehängte, angemeldete Person.
 * Nur in Routen verwenden, die mit @UseGuards(SitzungGuard) geschützt sind.
 */
export const AktuellePerson = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SitzungsPerson => {
    const req = ctx
      .switchToHttp()
      .getRequest<Request & { person?: SitzungsPerson }>();
    return req.person as SitzungsPerson;
  },
);
