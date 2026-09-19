/* Atrapy modulow natywnych, ktore nie dzialaja w srodowisku testowym Node. */
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(),
  deactivateKeepAwake: jest.fn(),
}));

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'pl', languageTag: 'pl-PL' }],
  getCalendars: () => [{ timeZone: 'Europe/Warsaw' }],
}));

jest.mock('react-native-vision-camera', () => ({
  Camera: 'Camera',
  useCameraDevice: () => null,
  useCameraPermission: () => ({ hasPermission: true, requestPermission: jest.fn() }),
  useFrameOutput: () => ({}),
}));

jest.mock('react-native-fast-tflite', () => ({
  useTensorflowModel: () => ({ state: 'loading' }),
  loadTensorflowModel: jest.fn(),
}));
