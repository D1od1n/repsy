/**
 * Ustawienia, cele dzienne i przypomnienia.
 *
 * ============================ PRYWATNOSC ============================
 * Te dane zostaja WYLACZNIE na urzadzeniu - nie sa synchronizowane z serwerem.
 * Godziny przypomnien czy wybrany motyw to sprawa tego telefonu, nie konta.
 * ====================================================================
 */
import type { SqlDriver } from '../db/driver';
import type { LocalDate } from '../../core/date/localDate';
import { DEFAULT_SETTINGS, type Reminder, type UserSettings } from '../../core/model';
import { normalizeGoal } from '../../core/goals/goals';

export class SettingsRepository {
  constructor(private readonly db: SqlDriver) {}

  async getSettings(): Promise<UserSettings> {
    const rows = await this.db.all<{ key: string; value: string }>(
      'SELECT key, value FROM settings',
    );

    const stored = new Map(rows.map((row) => [row.key, row.value]));
    const read = <K extends keyof UserSettings>(key: K, parse: (raw: string) => UserSettings[K]) => {
      const raw = stored.get(key);
      if (raw === undefined) return DEFAULT_SETTINGS[key];
      try {
        return parse(raw);
      } catch {
        return DEFAULT_SETTINGS[key];
      }
    };

    return {
      defaultGoal: read('defaultGoal', (raw) => normalizeGoal(Number(raw))),
      theme: read('theme', (raw) => raw as UserSettings['theme']),
      language: read('language', (raw) => raw as UserSettings['language']),
      remindersEnabled: read('remindersEnabled', (raw) => raw === 'true'),
      hapticsEnabled: read('hapticsEnabled', (raw) => raw === 'true'),
      debugOverlay: read('debugOverlay', (raw) => raw === 'true'),
      onboardingDone: read('onboardingDone', (raw) => raw === 'true'),
    };
  }

  async setSetting<K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K],
  ): Promise<void> {
    await this.db.run(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, String(value)],
    );
  }

  // ------------------------------------------------------------- cele dzienne

  /** Nadpisania celu dla konkretnych dni (brak wpisu = cel domyslny). */
  async getGoalOverrides(): Promise<Record<LocalDate, number>> {
    const rows = await this.db.all<{ local_date: string; goal: number }>(
      'SELECT local_date, goal FROM daily_goals',
    );

    const result: Record<LocalDate, number> = {};
    for (const row of rows) result[row.local_date] = row.goal;
    return result;
  }

  async setDailyGoal(date: LocalDate, goal: number): Promise<void> {
    await this.db.run(
      `INSERT INTO daily_goals (local_date, goal, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(local_date) DO UPDATE SET goal = excluded.goal, updated_at = excluded.updated_at`,
      [date, normalizeGoal(goal), Date.now()],
    );
  }

  /** Usuwa wyjatek - dany dzien wraca do celu domyslnego. */
  async clearDailyGoal(date: LocalDate): Promise<void> {
    await this.db.run('DELETE FROM daily_goals WHERE local_date = ?', [date]);
  }

  // ------------------------------------------------------------ przypomnienia

  async getReminders(): Promise<Reminder[]> {
    const rows = await this.db.all<{
      id: string;
      hour: number;
      minute: number;
      enabled: number;
      custom_message: string;
    }>('SELECT * FROM reminders ORDER BY hour, minute');

    return rows.map((row) => ({
      id: row.id,
      hour: row.hour,
      minute: row.minute,
      enabled: row.enabled === 1,
      customMessage: row.custom_message,
    }));
  }

  async saveReminder(reminder: Reminder): Promise<void> {
    await this.db.run(
      `INSERT INTO reminders (id, hour, minute, enabled, custom_message)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         hour = excluded.hour,
         minute = excluded.minute,
         enabled = excluded.enabled,
         custom_message = excluded.custom_message`,
      [
        reminder.id,
        clampHour(reminder.hour),
        clampMinute(reminder.minute),
        reminder.enabled ? 1 : 0,
        reminder.customMessage,
      ],
    );
  }

  async deleteReminder(id: string): Promise<void> {
    await this.db.run('DELETE FROM reminders WHERE id = ?', [id]);
  }
}

function clampHour(hour: number): number {
  return Math.min(23, Math.max(0, Math.round(hour)));
}

function clampMinute(minute: number): number {
  return Math.min(59, Math.max(0, Math.round(minute)));
}
