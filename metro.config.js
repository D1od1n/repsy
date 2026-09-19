const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Model TensorFlow Lite wczytywany przez require('...tflite') w wersji mobilnej.
config.resolver.assetExts.push('tflite');

// Wersja webowa: expo-sqlite dziala na wa-sqlite skompilowanym do WebAssembly
// i importuje plik .wasm jak zwykly zasob. Bez tego wpisu bundling na web
// przerywa sie bledem "Unable to resolve module ./wa-sqlite/wa-sqlite.wasm".
if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}

module.exports = config;
