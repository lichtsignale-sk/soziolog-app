import 'vitest';
import type { AxeMatchers } from 'vitest-axe/matchers';

// Erweitert die Vitest-Matcher um toHaveNoViolations (vitest-axe).
declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Assertion extends AxeMatchers {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
