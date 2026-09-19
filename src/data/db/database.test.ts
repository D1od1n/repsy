/**
 * Testy warstwy danych - uruchamiane na prawdziwym SQLite (node:sqlite),
 * wiec sprawdzaja faktyczny SQL, a nie atrape.
 */
import { createNodeDriver } from './nodeDriver';
import { getSchemaVersion, migrate } from './migrate';
import { LATEST_VERSION } from './migrations';
import type { SqlDriver } from './driver';
import { WorkoutRepository } from '../repositories/workoutRepository';
import { SettingsRepository } from '../repositories/settingsRepository';
import { OutboxRepository } from '../repositories/outboxRepository';
import type { Workout } from '../../core/model';

function makeWorkout(overrides: Partial<Workout> = {}): Workout {
  const startedAt = Date.parse('2026-09-19T10:00:00Z');
  return {
    id: 'workout-1',
    localDate: '2026-09-19',
    startedAt,
    endedAt: startedAt + 300_000,
    totalReps: 45,
    durationS: 300,
    source: 'camera',
    sets: [
      { index: 1, reps: 20, startedAt, endedAt: startedAt + 60_000 },
      { index: 2, reps: 25, startedAt: startedAt + 120_000, endedAt: startedAt + 180_000 },
    ],
    ...overrides,
  };
}

let db: SqlDriver;

beforeEach(async () => {
  db = createNodeDriver(':memory:');
  await migrate(db);
});

afterEach(async () => {
  await db.close();
});

describe('migracje', () => {
  it('doprowadzaja baze do najnowszej wersji', async () => {
    expect(await getSchemaVersion(db)).toBe(LATEST_VERSION);
  });

  it('ponowne uruchomienie nie psuje bazy', async () => {
    await migrate(db);
    await migrate(db);
    expect(await getSchemaVersion(db)).toBe(LATEST_VERSION);
  });

  it('tworzy wszystkie potrzebne tabele', async () => {
    const tables = await db.all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    const names = tables.map((t) => t.name);

    expect(names).toEqual(
      expect.arrayContaining([
        'workouts',
        'workout_sets',
        'daily_goals',
        'settings',
        'reminders',
        'sync_outbox',
        'friends_cache',
        'leaderboard_cache',
      ]),
    );
  });

  it('schemat nie zawiera zadnej kolumny na obraz z kamery', async () => {
    // Test wymusza zasade prywatnosci na poziomie bazy: gdyby ktos kiedys
    // dodal kolumne na zdjecie czy nagranie, ten test zapali sie na czerwono.
    const columns = await db.all<{ name: string }>(
      "SELECT name FROM pragma_table_info('workouts') UNION ALL SELECT name FROM pragma_table_info('workout_sets')",
    );
    const forbidden = /image|photo|video|frame|picture|thumbnail|media|blob/i;

    for (const column of columns) {
      expect(column.name).not.toMatch(forbidden);
    }
  });
});

describe('zapis treningow', () => {
  it('zapisuje i odczytuje trening razem z seriami', async () => {
    const repo = new WorkoutRepository(db);
    await repo.save(makeWorkout());

    const [loaded] = await repo.getByDate('2026-09-19');

    expect(loaded?.totalReps).toBe(45);
    expect(loaded?.sets).toHaveLength(2);
    expect(loaded?.sets[0]?.reps).toBe(20);
    expect(loaded?.sets[1]?.reps).toBe(25);
  });

  it('ponowny zapis tego samego treningu nie tworzy duplikatu', async () => {
    const repo = new WorkoutRepository(db);
    const workout = makeWorkout();

    await repo.save(workout);
    await repo.save(workout);
    await repo.save(workout);

    expect(await repo.getAll()).toHaveLength(1);

    // Serie tez nie moga sie powielic.
    const sets = await db.all('SELECT * FROM workout_sets');
    expect(sets).toHaveLength(2);
  });

  it('aktualizacja treningu nie zostawia starych serii', async () => {
    const repo = new WorkoutRepository(db);
    await repo.save(makeWorkout());

    await repo.save(
      makeWorkout({
        totalReps: 10,
        sets: [{ index: 1, reps: 10, startedAt: 0, endedAt: 1000 }],
      }),
    );

    const [loaded] = await repo.getAll();
    expect(loaded?.sets).toHaveLength(1);
    expect(loaded?.totalReps).toBe(10);
  });

  it('filtruje treningi po zakresie dat', async () => {
    const repo = new WorkoutRepository(db);
    await repo.save(makeWorkout({ id: 'a', localDate: '2026-09-14' }));
    await repo.save(makeWorkout({ id: 'b', localDate: '2026-09-17' }));
    await repo.save(makeWorkout({ id: 'c', localDate: '2026-09-25' }));

    const range = await repo.getRange('2026-09-14', '2026-09-20');
    expect(range.map((w) => w.id)).toEqual(['a', 'b']);
  });

  it('sumuje powtorzenia per dzien', async () => {
    const repo = new WorkoutRepository(db);
    await repo.save(makeWorkout({ id: 'a', localDate: '2026-09-19', totalReps: 40 }));
    await repo.save(makeWorkout({ id: 'b', localDate: '2026-09-19', totalReps: 60 }));

    const totals = await repo.getDatesWithTotals();
    expect(totals).toEqual([{ date: '2026-09-19', totalReps: 100 }]);
  });

  it('usuwa trening razem z seriami i wpisem w kolejce', async () => {
    const repo = new WorkoutRepository(db);
    const outbox = new OutboxRepository(db);
    await repo.save(makeWorkout());

    await repo.deleteById('workout-1');

    expect(await repo.getAll()).toHaveLength(0);
    expect(await db.all('SELECT * FROM workout_sets')).toHaveLength(0);
    expect(await outbox.count()).toBe(0);
  });
});

describe('kolejka synchronizacji', () => {
  it('zapis treningu dodaje go do kolejki', async () => {
    const repo = new WorkoutRepository(db);
    const outbox = new OutboxRepository(db);

    await repo.save(makeWorkout());

    const due = await outbox.getDue();
    expect(due).toHaveLength(1);
    expect(due[0]?.entity).toBe('workout');
    expect(due[0]?.entityId).toBe('workout-1');
  });

  it('wielokrotny zapis daje JEDEN wpis w kolejce', async () => {
    const repo = new WorkoutRepository(db);
    const outbox = new OutboxRepository(db);

    await repo.save(makeWorkout());
    await repo.save(makeWorkout({ totalReps: 60 }));
    await repo.save(makeWorkout({ totalReps: 80 }));

    expect(await outbox.count()).toBe(1);

    // W kolejce ma byc najswiezsza wersja danych.
    const [item] = await outbox.getDue();
    expect(JSON.parse(item!.payload).totalReps).toBe(80);
  });

  it('nieudana proba odsuwa kolejna w czasie', async () => {
    const repo = new WorkoutRepository(db);
    const outbox = new OutboxRepository(db);
    await repo.save(makeWorkout());

    const now = 1_000_000;
    const [item] = await outbox.getDue(now);
    await outbox.markFailed(item!.id, now);

    // Zaraz po bledzie wpis nie jest jeszcze gotowy do ponowienia.
    expect(await outbox.getDue(now)).toHaveLength(0);
    // Po odczekaniu wraca do kolejki.
    expect(await outbox.getDue(now + 60_000)).toHaveLength(1);
  });

  it('kolejne bledy wydluzaja odstep', async () => {
    const repo = new WorkoutRepository(db);
    const outbox = new OutboxRepository(db);
    await repo.save(makeWorkout());

    const now = 1_000_000;
    const [item] = await outbox.getDue(now);

    await outbox.markFailed(item!.id, now);
    const afterFirst = (await outbox.getDue(now + 10 * 60_000))[0];
    await outbox.markFailed(afterFirst!.id, now);
    const second = await db.get<{ next_attempt_at: number }>(
      'SELECT next_attempt_at FROM sync_outbox WHERE id = ?',
      [item!.id],
    );

    expect(second!.next_attempt_at).toBeGreaterThan(now + 5_000);
  });
});

describe('ustawienia', () => {
  it('zwraca wartosci domyslne dla pustej bazy', async () => {
    const repo = new SettingsRepository(db);
    const settings = await repo.getSettings();

    expect(settings.defaultGoal).toBe(100);
    expect(settings.theme).toBe('system');
    expect(settings.language).toBe('system');
  });

  it('zapisuje i odczytuje zmienione ustawienia', async () => {
    const repo = new SettingsRepository(db);

    await repo.setSetting('defaultGoal', 150);
    await repo.setSetting('theme', 'dark');
    await repo.setSetting('hapticsEnabled', false);

    const settings = await repo.getSettings();
    expect(settings.defaultGoal).toBe(150);
    expect(settings.theme).toBe('dark');
    expect(settings.hapticsEnabled).toBe(false);
  });

  it('przycina niepoprawny cel domyslny', async () => {
    const repo = new SettingsRepository(db);
    await repo.setSetting('defaultGoal', 99999);
    expect((await repo.getSettings()).defaultGoal).toBe(2000);
  });
});

describe('cele na konkretne dni', () => {
  it('zapisuje wyjatek tylko dla wybranego dnia', async () => {
    const repo = new SettingsRepository(db);

    await repo.setDailyGoal('2026-09-19', 40);
    await repo.setDailyGoal('2026-09-21', 150);

    const overrides = await repo.getGoalOverrides();
    expect(overrides).toEqual({ '2026-09-19': 40, '2026-09-21': 150 });
  });

  it('usuniecie wyjatku przywraca cel domyslny', async () => {
    const repo = new SettingsRepository(db);
    await repo.setDailyGoal('2026-09-19', 40);
    await repo.clearDailyGoal('2026-09-19');

    expect(await repo.getGoalOverrides()).toEqual({});
  });
});

describe('przypomnienia', () => {
  it('zapisuje kilka przypomnien i sortuje je po godzinie', async () => {
    const repo = new SettingsRepository(db);

    await repo.saveReminder({ id: 'r1', hour: 21, minute: 0, enabled: true, customMessage: '' });
    await repo.saveReminder({ id: 'r2', hour: 14, minute: 30, enabled: true, customMessage: '' });

    const reminders = await repo.getReminders();
    expect(reminders.map((r) => r.hour)).toEqual([14, 21]);
  });

  it('usuwa przypomnienie', async () => {
    const repo = new SettingsRepository(db);
    await repo.saveReminder({ id: 'r1', hour: 9, minute: 0, enabled: true, customMessage: '' });
    await repo.deleteReminder('r1');

    expect(await repo.getReminders()).toHaveLength(0);
  });

  it('przycina niepoprawna godzine', async () => {
    const repo = new SettingsRepository(db);
    await repo.saveReminder({ id: 'r1', hour: 99, minute: 99, enabled: true, customMessage: '' });

    const [reminder] = await repo.getReminders();
    expect(reminder?.hour).toBe(23);
    expect(reminder?.minute).toBe(59);
  });
});
