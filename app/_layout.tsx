/**
 * Korzen aplikacji: inicjalizacja, dostawcy kontekstu i kierowanie ruchem
 * miedzy onboardingiem a wlasciwa aplikacja.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Text, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getLocales } from 'expo-localization';

import { ThemeProvider } from '../src/theme/ThemeProvider';
import { useAppStore } from '../src/features/store/appStore';
import { useAuthStore } from '../src/features/auth/authStore';
import { useSyncStore } from '../src/features/sync/syncStore';
import { i18n, initI18n, resolveLanguage } from '../src/i18n';
import {
  configureNotificationHandler,
  rescheduleReminders,
} from '../src/features/notifications/notificationService';
import { LIGHT_COLORS } from '../src/theme/tokens';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Ranking nie musi byc odswiezany co sekunde - to dane z calego dnia.
      staleTime: 60_000,
      retry: 1,
    },
  },
});

/** Po tylu ms uznajemy, ze baza sie nie otworzy. */
const DATABASE_TIMEOUT_MS = 15_000;

/** Odrzuca obietnice, jesli nie rozstrzygnie sie w zadanym czasie. */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export default function RootLayout(): React.ReactElement {
  // Trzy stany zamiast jednej flagi: bez tego awaria bazy zostawiala
  // uzytkownika przy wiecznie krecacym sie kolku, bez zadnej informacji.
  const [bootState, setBootState] = useState<'loading' | 'ready' | 'failed'>('loading');

  const initApp = useAppStore((state) => state.init);
  const initAuth = useAuthStore((state) => state.init);
  const settings = useAppStore((state) => state.settings);

  useEffect(() => {
    let cancelled = false;

    const boot = async (): Promise<void> => {
      configureNotificationHandler();

      // Jezyk ustawiamy przed pierwszym renderem, zeby nie mignal angielski.
      const deviceLanguages = getLocales().map((locale) => locale.languageTag);
      initI18n(resolveLanguage('system', deviceLanguages));

      try {
        // Limit czasu jest tu istotny: gdy magazyn przegladarki jest
        // zablokowany, otwarcie bazy potrafi nie odpowiedziec ANI bledem,
        // ani wynikiem. Bez limitu aplikacja wisialaby w nieskonczonosc.
        await withTimeout(initApp(), DATABASE_TIMEOUT_MS);
      } catch {
        if (!cancelled) setBootState('failed');
        return;
      }

      // Logowanie jest opcjonalne - jego awaria (np. brak sieci) nie moze
      // blokowac treningu, ktory dziala w pelni lokalnie.
      try {
        await initAuth();
      } catch {
        /* aplikacja dziala dalej w trybie lokalnym */
      }

      if (!cancelled) setBootState('ready');
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [initApp, initAuth]);

  // Reakcja na zmiane jezyka w ustawieniach.
  useEffect(() => {
    const deviceLanguages = getLocales().map((locale) => locale.languageTag);
    initI18n(resolveLanguage(settings.language, deviceLanguages));
  }, [settings.language]);

  if (bootState !== 'ready') {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          backgroundColor: LIGHT_COLORS.background,
        }}
      >
        {bootState === 'loading' ? (
          <ActivityIndicator />
        ) : (
          // Komunikat celowo bez szczegolow technicznych - mowi, co zrobic,
          // a nie co sie zepsulo w srodku.
          <Text
            style={{ color: LIGHT_COLORS.text, fontSize: 16, textAlign: 'center', lineHeight: 24 }}
          >
            {i18n.t('errors.storageUnavailable')}
          </Text>
        )}
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider preference={settings.theme}>
          <QueryClientProvider client={queryClient}>
            <AppLifecycle />
            <NavigationGuard />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="workout" options={{ animation: 'fade' }} />
              <Stack.Screen name="settings" options={{ presentation: 'card' }} />
            </Stack>
            <StatusBar style="auto" />
          </QueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Reakcje na powrot do aplikacji: odswiezenie dnia (po polnocy albo po zmianie
 * strefy czasowej), synchronizacja i przeliczenie przypomnien.
 */
function AppLifecycle(): null {
  const refreshToday = useAppStore((state) => state.refreshToday);
  const session = useAuthStore((state) => state.session);
  const sync = useSyncStore((state) => state.sync);

  useEffect(() => {
    const onForeground = (): void => {
      refreshToday();
      void sync(session?.user.id ?? null);
      void refreshNotifications();
    };

    onForeground();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') onForeground();
    });

    return () => subscription.remove();
  }, [refreshToday, session, sync]);

  return null;
}

async function refreshNotifications(): Promise<void> {
  const state = useAppStore.getState();

  await rescheduleReminders({
    reminders: state.reminders,
    enabled: state.settings.remindersEnabled,
    goalFor: state.goalFor,
    totalFor: (date) =>
      state.workouts
        .filter((workout) => workout.localDate === date)
        .reduce((total, workout) => total + workout.totalReps, 0),
  });
}

/** Przekierowuje do onboardingu, dopoki uzytkownik nie jest gotowy. */
function NavigationGuard(): null {
  const status = useAuthStore((state) => state.status);
  const onboardingDone = useAppStore((state) => state.settings.onboardingDone);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (status === 'loading') return;

    const inOnboarding = segments[0] === 'onboarding';
    const needsAccount = status === 'signed-out' || status === 'needs-username';
    const needsOnboarding = needsAccount || !onboardingDone;

    if (needsOnboarding && !inOnboarding) {
      // Kierujemy dokladnie do tego kroku, ktorego brakuje.
      if (status === 'signed-out') router.replace('/onboarding');
      else if (status === 'needs-username') router.replace('/onboarding/username');
      else router.replace('/onboarding/goal');
    } else if (!needsOnboarding && inOnboarding) {
      router.replace('/(tabs)');
    }
  }, [status, onboardingDone, segments, router]);

  return null;
}
