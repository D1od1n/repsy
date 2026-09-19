const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Pozwala wczytac model TensorFlow Lite przez require('...tflite')
config.resolver.assetExts.push('tflite');

module.exports = config;
