/**
 * Glowny stan aplikacji (dane lokalne).
 *
 * Zrodlem prawdy jest SQLite na telefonie - ten store jest tylko trzymana
 * w pamieci kopia, zeby ekrany nie musialy odpytywac bazy przy kazdym renderze.
 * Kazda zmiana najpierw idzie do bazy, a dopiero potem do stanu.
 */
import { create } from 'zustand';

import { getDatabase } from '../../data/db';
import { OutboxRepository } from '../../data/repositories/outboxRepository';
import { SettingsRepository } from '../../data/repositories/settingsRepository';
import { WorkoutRepository } from '../../data/repositories/workoutRepository';
import { getDeviceTimeZone, todayLocal, type LocalDate } from '../../core/date/localDate';
import { normalizeGoal, resolveGoal } from '../../core/goals/goals';
import { computeStreak } from '../../core/streak/streak';
import { computeRecords, summarizeDay } from '../../core/stats/stats';
import {
  DEFAULT_SETTINGS,
  type DailySummary,
  type PersonalRecords,
  type Reminder,
  type StreakInfo,
  type UserSettings,
  type Workout,
  type WorkoutSet,
} from '../../core/model';
import { newId } from '../../core/id';

interface AppState {
  ready: boolean;
  settings: UserSettings;
  goalOverrides: Record<LocalDate, number>;
  workouts: Workout[];
  reminders: Reminder[];
  pendingSync: number;
  /** Dzisiejsza data lokalna - odswiezana przy wejsciu do aplikacji. */
  today: LocalDate;

  init: () => Promise<void>;
  refresh: () => Promise<void>;
  refreshToday: () => void;

  saveWorkout: (workout: Workout) => Promise<void>;
  addManualReps: (reps: number) => Promise<void>;
  deleteWorkout: (id: string) => Promise<void>;

  setSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => Promise<void>;
  setDailyGoal: (date: LocalDate, goal: number) => Promise<void>;
  clearDailyGoal: (date: LocalDate) => Promise<void>;

  saveReminder: (reminder: Reminder) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;

  // --- wartosci wyliczane ---
  goalFor: (date: LocalDate) => number;
  todaySummary: () => DailySummary;
  streak: () => StreakInfo;
  records: () => PersonalRecords;
}

async function repositories() {
  const db = await getDatabase();
  return {
    workouts: new WorkoutRepository(db),
    settings: new SettingsRepository(db),
    outbox: new OutboxRepository(db),
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  settings: DEFAULT_SETTINGS,
  goalOverrides: {},
  workouts: [],
  reminders: [],
  pendingSync: 0,
  today: todayLocal(getDeviceTimeZone()),

  init: async () => {
    await get().refresh();
    set({ ready: true });
  },

  refresh: async () => {
    const repos = await repositories();

    const [settings, goalOverrides, workouts, reminders, pendingSync] = await Promise.all([
      repos.settings.getSettings(),
      repos.settings.getGoalOverrides(),
      repos.workouts.getAll(),
      repos.settings.getReminders(),
      repos.outbox.count(),
    ]);

    set({
      settings,
      goalOverrides,
      workouts,
      reminders,
      pendingSync,
      today: todayLocal(getDeviceTimeZone()),
    });
  },

  /**
   * Przelicza "dzisiaj" wedlug zegara urzadzenia. Wolane przy powrocie do
   * aplikacji, zeby po polnocy (albo po zmianie strefy czasowej) ekran glowny
   * pokazywal juz nowy dzien.
   */
  refreshToday: () => {
    const today = todayLocal(getDeviceTimeZone());
    if (today !== get().today) set({ today });
  },

  saveWorkout: async (workout) => {
    const repos = await repositories();
    await repos.workouts.save(workout);

    const [workouts, pendingSync] = await Promise.all([
      repos.workouts.getAll(),
      repos.outbox.count(),
    ]);
    set({ workouts, pendingSync });
  },

  /**
   * Reczne dopisanie pompek - potrzebne, gdy ktos cwiczyl bez telefonu albo
   * gdy kamera zawiedzie. Zapisujemy je jako jedna seria ze zrodlem 'manual',
   * zeby dalo sie je odroznic od liczonych kamera.
   */
  addManualReps: async (reps) => {
    if (reps <= 0) return;

    const now = Date.now();
    const sets: WorkoutSet[] = [{ index: 1, reps, startedAt: now, endedAt: now }];

    await get().saveWorkout({
      id: newId(),
      localDate: todayLocal(getDeviceTimeZone()),
      startedAt: now,
      endedAt: now,
      totalReps: reps,
      durationS: 0,
      source: 'manual',
      sets,
    });
  },

  deleteWorkout: async (id) => {
    const repos = await repositories();
    await repos.workouts.deleteById(id);
    set({ workouts: await repos.workouts.getAll() });
  },

  setSetting: async (key, value) => {
    const repos = await repositories();
    await repos.settings.setSetting(key, value);
    set({ settings: { ...get().settings, [key]: value } });
  },

  setDailyGoal: async (date, goal) => {
    const repos = await repositories();
    await repos.settings.setDailyGoal(date, goal);
    set({ goalOverrides: { ...get().goalOverrides, [date]: normalizeGoal(goal) } });
  },

  clearDailyGoal: async (date) => {
    const repos = await repositories();
    await repos.settings.clearDailyGoal(date);

    const overrides = { ...get().goalOverrides };
    delete overrides[date];
    set({ goalOverrides: overrides });
  },

  saveReminder: async (reminder) => {
    const repos = await repositories();
    await repos.settings.saveReminder(reminder);
    set({ reminders: await repos.settings.getReminders() });
  },

  deleteReminder: async (id) => {
    const repos = await repositories();
    await repos.settings.deleteReminder(id);
    set({ reminders: await repos.settings.getReminders() });
  },

  // ------------------------------------------------------------- wyliczane

  goalFor: (date) => resolveGoal(date, get().settings.defaultGoal, get().goalOverrides),

  todaySummary: () => {
    const { workouts, today } = get();
    return summarizeDay(workouts, today, get().goalFor(today));
  },

  streak: () => {
    const { workouts, today } = get();

    const totals = new Map<LocalDate, number>();
    for (const workout of workouts) {
      totals.set(workout.localDate, (totals.get(workout.localDate) ?? 0) + workout.totalReps);
    }

    const days = [...totals.entries()].map(([date, total]) => ({
      date,
      achieved: total >= get().goalFor(date),
    }));

    return computeStreak(days, today);
  },

  records: () => computeRecords(get().workouts, get().streak().longest),
}));
