/**
 * Limit czasu dla testow komponentow.
 *
 * Domyslne 5 s Jesta jest pomyslane pod testy jednostkowe. Pierwszy render
 * komponentu React Native przez jest-expo potrafi na zimnym runnerze CI ten
 * limit przekroczyc, choc lokalnie trwa ulamek sekundy. Objawialo sie to
 * jako "losowo niestabilny" test - zawsze pierwszy w pliku, niezaleznie od
 * tego, co sprawdzal.
 *
 * Ustawiamy to TUTAJ, a nie w jest.config.js: `testTimeout` nie jest
 * dozwolone wewnatrz konfiguracji projektu i Jest ignoruje je z ostrzezeniem
 * "Unknown option", ktore latwo przeoczyc w logu.
 */
jest.setTimeout(30_000);
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
