/**
 * Korzen aplikacji: inicjalizacja, dostawcy kontekstu i kierowanie ruchem
 * miedzy onboardingiem a wlasciwa aplikacja.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';
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
import { initI18n, resolveLanguage } from '../src/i18n';
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

export default function RootLayout(): React.ReactElement {
  const [booted, setBooted] = useState(false);

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

      await initApp();
      await initAuth();

      if (!cancelled) setBooted(true);
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

  if (!booted) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: LIGHT_COLORS.background,
        }}
      >
        <ActivityIndicator />
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
              <Stack.Screen name="(onboarding)" />
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

    const inOnboarding = segments[0] === '(onboarding)';
    const needsAccount = status === 'signed-out' || status === 'needs-username';
    const needsOnboarding = needsAccount || !onboardingDone;

    if (needsOnboarding && !inOnboarding) {
      // Kierujemy dokladnie do tego kroku, ktorego brakuje.
      if (status === 'signed-out') router.replace('/(onboarding)');
      else if (status === 'needs-username') router.replace('/(onboarding)/username');
      else router.replace('/(onboarding)/goal');
    } else if (!needsOnboarding && inOnboarding) {
      router.replace('/(tabs)');
    }
  }, [status, onboardingDone, segments, router]);

  return null;
}
