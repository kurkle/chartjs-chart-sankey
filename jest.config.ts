import type { Config } from 'jest'

const config: Config = {
  collectCoverage: true,
  coverageProvider: 'v8',
  coverageReporters: ['lcov', 'text'],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  roots: ['src'],
  testEnvironment: 'node',
  transform: {
    '^.+.tsx?$': ['ts-jest', { diagnostics: { ignoreCodes: [151002] }, useESM: true }],
  },
}

export default config
