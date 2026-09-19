/**
 * Konfiguracja Expo dla Repsy.
 *
 * Uzywamy app.config.js (zamiast app.json), zeby wczytac wartosci specyficzne dla
 * konta (Google Sign-In, Supabase) ze zmiennych srodowiskowych z pliku .env.
 * Dzieki temu w repo nie ma zadnych sekretow, a projekt buduje sie od razu po
 * sklonowaniu - nawet zanim uzupelnisz .env (funkcje wymagajace konfiguracji
 * pokaza wtedy czytelny komunikat zamiast sie wywalic).
 */

// Gdy brak konfiguracji Google, uzywamy poprawnego skladniowo, ale nieaktywnego
// schematu URL. Aplikacja sie zbuduje i uruchomi; przycisk Google pokaze instrukcje.
const GOOGLE_IOS_URL_SCHEME_PLACEHOLDER =
  'com.googleusercontent.apps.000000000000-0000000000000000000000000000000';

const googleIosUrlScheme =
  process.env.GOOGLE_IOS_URL_SCHEME || GOOGLE_IOS_URL_SCHEME_PLACEHOLDER;

module.exports = {
  expo: {
    name: 'Repsy',
    slug: 'repsy',
    version: '1.0.0',
    orientation: 'portrait',
    scheme: 'repsy',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    assetBundlePatterns: ['**/*'],

    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.repsy.app',
      usesAppleSignIn: true,
      infoPlist: {
        // Kamera sluzy WYLACZNIE do lokalnej analizy pozycji ciala.
        NSCameraUsageDescription:
          'Kamera sluzy do liczenia pompek. Obraz jest analizowany wylacznie na Twoim telefonie i nigdy nie jest zapisywany ani wysylany.',
        ITSAppUsesNonExemptEncryption: false,
      },
    },

    android: {
      package: 'com.repsy.app',
      edgeToEdgeEnabled: true,
      adaptiveIcon: { backgroundColor: '#0B0B0F' },
      permissions: ['android.permission.CAMERA', 'android.permission.VIBRATE'],
      // Aplikacja nie nagrywa dzwieku ani nie zapisuje plikow z kamery.
      blockedPermissions: [
        'android.permission.RECORD_AUDIO',
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.READ_MEDIA_VIDEO',
      ],
    },

    plugins: [
      'expo-router',
      'expo-secure-store',
      'expo-localization',
      'expo-apple-authentication',
      [
        'expo-splash-screen',
        { backgroundColor: '#FFFFFF', dark: { backgroundColor: '#0B0B0F' }, resizeMode: 'contain' },
      ],
      // UWAGA: react-native-vision-camera 5.x NIE dostarcza juz wtyczki Expo
      // (nie ma app.plugin.js). Wpisanie go tutaj powoduje blad buildu, bo Expo
      // probuje zaladowac sama biblioteke jako wtyczke. Uprawnienia kamery
      // deklarujemy wiec recznie: ios.infoPlist.NSCameraUsageDescription
      // oraz android.permissions ponizej.
      ['@react-native-google-signin/google-signin', { iosUrlScheme: googleIosUrlScheme }],
      [
        'react-native-fast-tflite',
        {
          // Akceleracja sprzetowa modelu: CoreML na iOS, biblioteki GPU na Androidzie.
          // Bez tego inferencja poszlaby na procesor i zjadalaby baterie.
          enableCoreMLDelegate: true,
          enableAndroidGpuLibraries: true,
        },
      ],
      [
        'expo-build-properties',
        {
          // Expo SDK 57 wymaga minimum iOS 16.4.
          ios: { deploymentTarget: '16.4' },
          android: { minSdkVersion: 26, compileSdkVersion: 36, targetSdkVersion: 36 },
        },
      ],
      [
        'expo-notifications',
        { color: '#FF6B35', defaultChannel: 'reminders' },
      ],
    ],

    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
      googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
      googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
      // Klucz 'eas' dodajemy TYLKO wtedy, gdy projectId faktycznie istnieje.
      // Pusty string nie jest poprawnym UUID i 'eas build' przerywa prace
      // komunikatem o nieprawidlowym identyfikatorze, zamiast po prostu
      // poprosic o powiazanie projektu (`eas init`).
      ...(process.env.EAS_PROJECT_ID
        ? { eas: { projectId: process.env.EAS_PROJECT_ID } }
        : {}),
    },
  },
};
