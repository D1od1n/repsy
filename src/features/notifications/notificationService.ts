/**
 * Przypomnienia o dziennym celu.
 *
 * ============================ PRYWATNOSC ============================
 * Powiadomienia sa w calosci lokalne - planuje je system operacyjny telefonu.
 * Nie ma tu push notifications, tokenow urzadzenia ani wysylania czegokolwiek
 * na serwer.
 * ====================================================================
 *
 * Przy kazdym przeliczeniu kasujemy wszystko i planujemy od nowa. Przy kilku
 * przypomnieniach dziennie to operacja na kilkunastu wpisach, a gwarantuje,
 * ze nigdy nie zostanie nam "sierota" po skasowanej godzinie.
 */
import * as Notifications from 'expo-notifications';

import { getDeviceTimeZone, type LocalDate } from '../../core/date/localDate';
import {
  localClock,
  planNotifications,
  toFireDate,
  type PlannedNotification,
} from '../../core/notifications/schedule';
import type { Reminder } from '../../core/model';
import { i18n } from '../../i18n';

/** Na ile dni do przodu planujemy powiadomienia. */
const DAYS_AHEAD = 7;

export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export type PermissionResult = 'granted' | 'denied' | 'undetermined';

export async function requestNotificationPermission(): Promise<PermissionResult> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return 'granted';

    if (!current.canAskAgain) return 'denied';

    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted ? 'granted' : 'denied';
  } catch {
    return 'undetermined';
  }
}

export async function hasNotificationPermission(): Promise<boolean> {
  try {
    return (await Notifications.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

interface RescheduleInput {
  reminders: readonly Reminder[];
  enabled: boolean;
  goalFor: (date: LocalDate) => number;
  totalFor: (date: LocalDate) => number;
}

/**
 * Przelicza i ustawia wszystkie przypomnienia.
 * Wolane po treningu, po zmianie ustawien i przy wejsciu do aplikacji.
 */
export async function rescheduleReminders(input: RescheduleInput): Promise<number> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();

    if (!input.enabled) return 0;
    if (!(await hasNotificationPermission())) return 0;

    const timeZone = getDeviceTimeZone();
    const clock = localClock(new Date(), timeZone);

    const planned = planNotifications({
      reminders: input.reminders,
      today: clock.today,
      nowHour: clock.hour,
      nowMinute: clock.minute,
      daysAhead: DAYS_AHEAD,
      goalFor: input.goalFor,
      totalFor: input.totalFor,
      enabled: input.enabled,
    });

    for (const notification of planned) {
      const fireAt = toFireDate(notification);
      // Zabezpieczenie na wypadek, gdyby chwila wypadla juz w przeszlosci.
      if (fireAt.getTime() <= Date.now()) continue;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: i18n.t('notifications.defaultTitle'),
          body: bodyFor(notification),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireAt,
        },
      });
    }

    return planned.length;
  } catch {
    // Brak powiadomien nie moze wywrocic aplikacji.
    return 0;
  }
}

function bodyFor(notification: PlannedNotification): string {
  if (notification.customMessage.trim() !== '') return notification.customMessage;

  // Liczbe brakujacych powtorzen znamy tylko dla dzisiaj.
  if (notification.remaining !== null && notification.remaining > 0) {
    return i18n.t('notifications.reminderRemaining', { count: notification.remaining });
  }

  return i18n.t('notifications.reminderGeneric');
}

export async function cancelAllReminders(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // ignorujemy - brak zaplanowanych powiadomien tez jest poprawnym stanem
  }
}
