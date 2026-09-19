/**
 * Dwa oddzielne projekty testowe:
 *
 *  core - czysty TypeScript w srodowisku Node. Tu zyje cala logika liczenia pompek,
 *         statystyk, streaka i synchronizacji. Testy dzialaja bez telefonu i bez
 *         React Native, dzieki czemu sa szybkie i deterministyczne.
 *
 *  app  - komponenty React Native (preset jest-expo).
 */
const tsTransform = [
  'ts-jest',
  {
    tsconfig: {
      module: 'commonjs',
      target: 'es2022',
      lib: ['es2022'],
      esModuleInterop: true,
      resolveJsonModule: true,
      strict: true,
      skipLibCheck: true,
      types: ['jest', 'node'],
    },
  },
];

module.exports = {
  projects: [
    {
      displayName: 'core',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/src/core/**/*.test.ts',
        '<rootDir>/src/data/**/*.test.ts',
        '<rootDir>/src/i18n/**/*.test.ts',
      ],
      transform: { '^.+\.ts$': tsTransform },
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
    },
    {
      displayName: 'app',
      preset: 'jest-expo',
      testMatch: ['<rootDir>/src/**/*.test.tsx', '<rootDir>/app/**/*.test.tsx'],
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-vision-camera|react-native-worklets|@supabase/.*))',
      ],
    },
  ],
};
