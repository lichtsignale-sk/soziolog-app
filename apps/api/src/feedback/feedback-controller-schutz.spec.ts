import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { SitzungGuard } from '../common/guards/sitzung.guard';
import { FeedbackController } from './feedback.controller';

/**
 * Beide Feedback-Routen verlangen eine Sitzung, und der Versand hat ein
 * eigenes, strenges Limit. Ohne diesen Test fiele ein versehentlich
 * entfernter Guard erst im Betrieb auf.
 */
describe('Schutz der Feedback-Routen', () => {
  it('hängt den ganzen Controller an den SitzungGuard', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, FeedbackController) as unknown[];
    expect(guards).toContain(SitzungGuard);
  });

  it('begrenzt den Versand enger als das globale Limit', () => {
    const methode = FeedbackController.prototype.sende;
    const limit = Reflect.getMetadata('THROTTLER:LIMITdefault', methode) as number;
    const ttl = Reflect.getMetadata('THROTTLER:TTLdefault', methode) as number;
    expect(limit).toBe(3);
    expect(ttl).toBe(600_000);
  });
});
