const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: ['node_modules/**', 'dist/**', 'android/**', 'ios/**', '.expo/**', '.export-check*/**'],
  },
  {
    // Pliki testowe i konfiguracja Jesta korzystaja z globalnego `jest`.
    files: ['**/*.test.ts', '**/*.test.tsx', 'jest.setup.js', 'jest.config.js'],
    languageOptions: {
      globals: { jest: 'readonly', describe: 'readonly', it: 'readonly', expect: 'readonly',
                 beforeAll: 'readonly', afterAll: 'readonly', beforeEach: 'readonly', afterEach: 'readonly' },
    },
  },
  {
    rules: {
      // Model TensorFlow Lite wczytujemy przez require - to wymog Metro.
      '@typescript-eslint/no-require-imports': 'off',
      // i18next eksportuje te nazwy takze osobno; nasze uzycie domyslnego
      // eksportu jest zgodne z dokumentacja biblioteki.
      'import/no-named-as-default-member': 'off',
    },
  },
];
