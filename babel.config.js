module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { reanimated: false }]],
    plugins: [
      // react-native-worklets/plugin MUSI byc ostatni.
      // Obsluguje worklety Reanimated 4 oraz worklety klatek VisionCamera.
      'react-native-worklets/plugin',
    ],
  };
};
