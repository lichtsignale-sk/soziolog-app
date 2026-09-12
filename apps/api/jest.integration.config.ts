import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.integration.spec.ts'],
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@soziolog/shared$': '<rootDir>/../../packages/shared/src/index.ts',
  },
  // Integrationstests teilen sich EINE echte DB und mutieren gemeinsame Seed-
  // Daten (Temp-Kreise/Mitgliedschaften). Deshalb strikt seriell ausführen,
  // damit sich die Testdateien nicht gegenseitig die Zählungen verfälschen.
  maxWorkers: 1,
};

export default config;
