/**
 * Ekran treningu.
 *
 * ============================ PRYWATNOSC ============================
 * Podglad z kamery jest tylko wyswietlany. Aplikacja nie ma wyjscia foto ani
 * wideo, nie zapisuje klatek i niczego nie wysyla. Analiza pozycji ciala dzieje
 * sie w calosci na tym telefonie.
 * ====================================================================
 *
 * Interfejs jest celowo ubogi: podczas pompek uzytkownik patrzy na ekran
 * z podlogi, przez ulamek sekundy. Liczy sie wielka liczba i jeden komunikat.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { repFeedback } from '../../src/features/workout/haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { useTheme } from '../../src/theme/ThemeProvider';
import { usePoseDetection } from '../../src/features/workout/usePoseDetection';
import { useAppStore } from '../../src/features/store/appStore';
import {
  createSession,
  finishSession,
  registerRep,
  tick,
  type SessionState,
} from '../../src/core/workout/session';
import type { DetectionResult } from '../../src/core/pushup/detector';
import type { SetupIssue } from '../../src/core/pose/quality';
import { getDeviceTimeZone, todayLocal } from '../../src/core/date/localDate';
import { useWorkoutResultStore } from '../../src/features/workout/workoutResultStore';

/** Jak dlugo trzymamy komunikat "Zejdz nizej" na ekranie. */
const MESSAGE_DURATION_MS = 1500;

export default function WorkoutScreen(): React.ReactElement {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const settings = useAppStore((state) => state.settings);
  const saveWorkout = useAppStore((state) => state.saveWorkout);
  const setLastResult = useWorkoutResultStore((state) => state.setResult);

  // Stan sesji trzymamy w ref - zmienia sie przy kazdym powtorzeniu i nie
  // powinien powodowac przerysowania calego ekranu.
  const sessionRef = useRef<SessionState | null>(null);
  const [counting, setCounting] = useState(false);

  const [reps, setReps] = useState(0);
  const [phase, setPhase] = useState<string>('NO_POSE');
  const [issue, setIssue] = useState<SetupIssue | null>('NO_POSE');
  const [messageKey, setMessageKey] = useState<string | null>(null);
  const [debug, setDebug] = useState<{ h: number; progress: number } | null>(null);

  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Wartosci czytane wewnatrz analizy klatek trzymamy w ref-ach.
   *
   * To nie jest mikrooptymalizacja, tylko warunek poprawnosci: funkcja
   * analizujaca klatki jest przekazywana do workletu kamery, ktory zapamietuje
   * ja w momencie utworzenia. Gdyby czytala `counting` wprost z domkniecia,
   * po rozpoczeciu liczenia moglaby dalej widziec stara wartosc `false`
   * i NIE ZALICZALABY zadnego powtorzenia. Ref zawsze zwraca stan biezacy.
   */
  const countingRef = useRef(false);
  const hapticsRef = useRef(settings.hapticsEnabled);
  const debugRef = useRef(settings.debugOverlay);

  useEffect(() => {
    hapticsRef.current = settings.hapticsEnabled;
    debugRef.current = settings.debugOverlay;
  }, [settings.hapticsEnabled, settings.debugOverlay]);

  const showMessage = useCallback((key: string) => {
    setMessageKey(key);
    if (messageTimer.current !== null) clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setMessageKey(null), MESSAGE_DURATION_MS);
  }, []);

  /**
   * Wynik analizy jednej klatki. Celowo aktualizujemy stan Reacta tylko wtedy,
   * gdy cos sie faktycznie zmienilo - inaczej mielibysmy kilkanascie
   * przerysowan na sekunde. Funkcja nie ma zaleznosci, wiec jej tozsamosc
   * jest stala przez caly trening.
   */
  const handleResult = useCallback(
    (result: DetectionResult) => {
      setPhase((previous) => (previous === result.state.phase ? previous : result.state.phase));
      setIssue((previous) => (previous === result.issue ? previous : result.issue));

      if (debugRef.current) {
        setDebug({ h: result.metrics?.h ?? 0, progress: result.state.progress });
      }

      if (!countingRef.current) return;

      for (const event of result.events) {
        if (event.type === 'REP') {
          const now = Date.now();
          const session = sessionRef.current ?? createSession(now);
          sessionRef.current = registerRep(session, now).state;

          setReps(sessionRef.current.totalReps);

          if (hapticsRef.current) {
            repFeedback();
          }
        }

        if (event.type === 'TOO_SHALLOW') {
          showMessage('workout.goDeeper');
        }
      }
    },
    [showMessage],
  );

  const pose = usePoseDetection({ enabled: true, onResult: handleResult });

  // Ekran nie moze zgasnac w trakcie serii.
  useEffect(() => {
    void activateKeepAwakeAsync();
    return () => {
      void deactivateKeepAwake();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (messageTimer.current !== null) clearTimeout(messageTimer.current);
    };
  }, []);

  // Zegar zamykajacy serie po dluzszej przerwie.
  useEffect(() => {
    if (!counting) return;

    const interval = setInterval(() => {
      const session = sessionRef.current;
      if (session === null) return;
      sessionRef.current = tick(session, Date.now()).state;
    }, 1000);

    return () => clearInterval(interval);
  }, [counting]);

  const readyToStart = pose.status === 'ready' && issue === null && phase !== 'CALIBRATING';

  const start = (): void => {
    pose.reset();
    sessionRef.current = createSession(Date.now());
    setReps(0);
    countingRef.current = true;
    setCounting(true);
  };

  const finish = useCallback(async (): Promise<void> => {
    const session = sessionRef.current;
    countingRef.current = false;
    setCounting(false);

    if (session === null) {
      router.back();
      return;
    }

    const { workout } = finishSession(session, Date.now(), todayLocal(getDeviceTimeZone()));

    if (workout === null) {
      router.back();
      return;
    }

    await saveWorkout(workout);
    setLastResult(workout);
    router.replace('/workout/summary');
  }, [router, saveWorkout, setLastResult]);

  const confirmFinish = (): void => {
    if (reps === 0) {
      void finish();
      return;
    }

    Alert.alert(t('workout.finishConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('workout.finish'), style: 'destructive', onPress: () => void finish() },
    ]);
  };

  // ------------------------------------------------------- stany brzegowe

  if (!pose.hasPermission) {
    return (
      <PermissionRequest
        onGrant={() => void pose.requestPermission()}
        onCancel={() => router.back()}
      />
    );
  }

  if (pose.status === 'no-camera') {
    return <ErrorState messageKey="workout.error.noCamera" onClose={() => router.back()} />;
  }

  if (pose.status === 'error') {
    return (
      <ErrorState
        messageKey={pose.errorKey ?? 'errors.generic'}
        onClose={() => router.back()}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/*
        Podglad kamery przygotowuje hook, bo rozni sie miedzy platformami:
        na telefonie jest to natywny komponent kamery, w przegladarce element
        <video>. Ekran nie musi o tym wiedziec.
      */}
      {pose.preview}

      {/* Przyciemnienie podgladu - liczby maja byc czytelne, nie obraz. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]} />

      <Screen style={{ backgroundColor: 'transparent' }}>
        <View style={{ flex: 1, padding: theme.spacing.lg, justifyContent: 'space-between' }}>
          {/* ------------------------------------------------ gora */}
          <View style={{ alignItems: 'flex-end' }}>
            <Pressable
              onPress={confirmFinish}
              accessibilityRole="button"
              accessibilityLabel={t('workout.finish')}
              style={{
                paddingHorizontal: theme.spacing.base,
                paddingVertical: theme.spacing.sm,
                borderRadius: theme.radius.full,
                backgroundColor: 'rgba(255,255,255,0.15)',
              }}
            >
              <Text variant="callout" style={{ color: '#FFFFFF' }}>
                {counting ? t('workout.finish') : t('common.close')}
              </Text>
            </Pressable>
          </View>

          {/* -------------------------------------------- srodek */}
          <View style={{ alignItems: 'center' }}>
            {counting ? (
              <>
                <Text
                  variant="counter"
                  tabular
                  style={{ color: '#FFFFFF' }}
                  accessibilityLabel={`${reps}`}
                >
                  {reps}
                </Text>
                <Text variant="title3" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  {t('common.reps', { count: reps })}
                </Text>
              </>
            ) : (
              <SetupChecklist issue={issue} ready={readyToStart} phase={phase} />
            )}
          </View>

          {/* ---------------------------------------------- dol */}
          <View style={{ minHeight: 140, justifyContent: 'flex-end' }}>
            {messageKey !== null && (
              <View
                style={{
                  backgroundColor: theme.colors.accent,
                  paddingVertical: theme.spacing.md,
                  borderRadius: theme.radius.full,
                  alignItems: 'center',
                  marginBottom: theme.spacing.base,
                }}
              >
                <Text variant="title3" style={{ color: '#FFFFFF' }}>
                  {t(messageKey)}
                </Text>
              </View>
            )}

            {counting ? (
              <Text variant="callout" align="center" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {issue === null ? t('workout.ready') : t(`workout.issue.${issue}`)}
              </Text>
            ) : (
              <Button
                large
                title={t('workout.startCounting')}
                onPress={start}
                disabled={!readyToStart}
              />
            )}

            {settings.debugOverlay && debug !== null && (
              <Text
                variant="caption"
                align="center"
                tabular
                style={{ color: 'rgba(255,255,255,0.5)', marginTop: theme.spacing.sm }}
              >
                {`phase=${phase}  h=${debug.h.toFixed(3)}  p=${debug.progress.toFixed(2)}  issue=${issue ?? '-'}`}
              </Text>
            )}
          </View>
        </View>
      </Screen>
    </View>
  );
}

/** Lista kontrolna pokazywana przed rozpoczeciem liczenia. */
function SetupChecklist({
  issue,
  ready,
  phase,
}: {
  issue: SetupIssue | null;
  ready: boolean;
  phase: string;
}): React.ReactElement {
  const { t } = useTranslation();
  const theme = useTheme();

  const silhouetteOk = issue !== 'NO_POSE' && issue !== 'LOW_CONFIDENCE';
  const positionOk = issue === null;

  const line = (ok: boolean, label: string): React.ReactElement => (
    <Text
      variant="title3"
      style={{ color: ok ? '#4ADE80' : 'rgba(255,255,255,0.45)', marginBottom: theme.spacing.sm }}
    >
      {`${ok ? '✓' : '○'}  ${label}`}
    </Text>
  );

  return (
    <View style={{ alignItems: 'flex-start' }}>
      <Text
        variant="title2"
        style={{ color: '#FFFFFF', marginBottom: theme.spacing.lg }}
        align="center"
      >
        {t('workout.setupTitle')}
      </Text>

      {line(silhouetteOk, t('workout.checkSilhouette'))}
      {line(positionOk, t('workout.checkPosition'))}
      {line(ready, t('workout.checkReady'))}

      <View style={{ height: theme.spacing.base }} />

      <Text variant="footnote" style={{ color: 'rgba(255,255,255,0.6)' }}>
        {issue !== null
          ? t(`workout.issue.${issue}`)
          : phase === 'CALIBRATING'
            ? t('workout.calibrating')
            : t('workout.setupInstruction')}
      </Text>
    </View>
  );
}

function PermissionRequest({
  onGrant,
  onCancel,
}: {
  onGrant: () => void;
  onCancel: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Screen style={{ padding: theme.spacing.lg, justifyContent: 'center' }}>
      <Text variant="title2">{t('workout.permission.title')}</Text>
      <View style={{ height: theme.spacing.base }} />
      <Text variant="body" color="textSecondary">
        {t('workout.permission.body')}
      </Text>
      <View style={{ height: theme.spacing.xl }} />
      <Button title={t('workout.permission.grant')} onPress={onGrant} />
      <View style={{ height: theme.spacing.sm }} />
      <Button variant="ghost" title={t('common.cancel')} onPress={onCancel} />
    </Screen>
  );
}

function ErrorState({
  messageKey,
  onClose,
}: {
  messageKey: string;
  onClose: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Screen style={{ padding: theme.spacing.lg, justifyContent: 'center' }}>
      <Text variant="title3" align="center">
        {t(messageKey)}
      </Text>
      <View style={{ height: theme.spacing.xl }} />
      <Button title={t('common.close')} onPress={onClose} />
    </Screen>
  );
}
