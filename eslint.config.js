const expoConfig = require('eslint-config-expo/flat');

/** Globalne obiekty srodowiska Node (skrypty pomocnicze i konfiguracja). */
const NODE_GLOBALS = {
  __dirname: 'readonly',
  __filename: 'readonly',
  Buffer: 'readonly',
  process: 'readonly',
  console: 'readonly',
  module: 'writable',
  require: 'readonly',
  exports: 'writable',
};

/** Globalne obiekty przegladarki (skrypty z katalogu public/). */
const BROWSER_GLOBALS = {
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  URL: 'readonly',
  console: 'readonly',
};

/** Globalne obiekty kontekstu Service Workera. */
const SERVICE_WORKER_GLOBALS = {
  self: 'readonly',
  caches: 'readonly',
  fetch: 'readonly',
  Request: 'readonly',
  Response: 'readonly',
  URL: 'readonly',
  console: 'readonly',
};

module.exports = [
  ...expoConfig,
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'android/**',
      'ios/**',
      '.expo/**',
      '.export-check*/**',
      '.export-web/**',
      // Pliki pobierane skryptem, nie pisane recznie.
      'public/models/**',
      'public/sql/**',
    ],
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
    // Skrypty pomocnicze i konfiguracja Expo dzialaja w Node, a nie w aplikacji.
    files: ['scripts/**/*.mjs', 'app.config.js', 'metro.config.js', 'babel.config.js', 'eslint.config.js'],
    languageOptions: { globals: NODE_GLOBALS },
  },
  {
    // Skrypty serwowane bezposrednio do przegladarki - nie przechodza przez
    // bundler, wiec nie ma tu importow ani skladni modulow.
    files: ['public/frame-guard.js', 'public/register-sw.js'],
    languageOptions: { globals: BROWSER_GLOBALS, sourceType: 'script' },
  },
  {
    files: ['public/sw.js'],
    languageOptions: { globals: SERVICE_WORKER_GLOBALS, sourceType: 'script' },
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
