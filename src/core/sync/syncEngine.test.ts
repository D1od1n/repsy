/**
 * Testy synchronizacji.
 *
 * Najwazniejsze pytanie, na ktore odpowiadaja: czy trening moze sie zdublowac?
 * Sprawdzamy to od strony kolejki (ponowne wysylki, bledy sieci, ponowienia)
 * oraz od strony danych wysylanych na serwer.
 */
import { createNodeDriver } from '../../data/db/nodeDriver';
import { migrate } from '../../data/db/migrate';
import type { SqlDriver } from '../../data/db/driver';
import { OutboxRepository } from '../../data/repositories/outboxRepository';
import { WorkoutRepository } from '../../data/repositories/workoutRepository';
import { runSync, type WorkoutPusher } from './syncEngine';
import type { Workout } from '../model';

function makeWorkout(id: string, totalReps = 45): Workout {
  const startedAt = Date.parse('2026-09-19T10:00:00Z');
  return {
    id,
    localDate: '2026-09-19',
    startedAt,
    endedAt: startedAt + 300_000,
    totalReps,
    durationS: 300,
    source: 'camera',
    sets: [{ index: 1, reps: totalReps, startedAt, endedAt: startedAt + 60_000 }],
  };
}

/** Atrapa serwera: zapamietuje, co dostala i w ilu wywolaniach. */
function createPusher(options: { failTimes?: number } = {}) {
  let remainingFailures = options.failTimes ?? 0;
  const received: Workout[] = [];

  const pusher: WorkoutPusher = {
    push: async (workout) => {
      if (remainingFailures > 0) {
        remainingFailures -= 1;
        throw new Error('brak sieci');
      }
      received.push(workout);
    },
  };

  return {
    pusher,
    received,
    /** Ile UNIKALNYCH treningow faktycznie doszlo na "serwer". */
    uniqueIds: () => new Set(received.map((w) => w.id)).size,
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

describe('wysylka treningow', () => {
  it('wysyla zapisany trening i czysci kolejke', async () => {
    const repo = new WorkoutRepository(db);
    const outbox = new OutboxRepository(db);
    await repo.save(makeWorkout('w1'));

    const { pusher, received } = createPusher();
    const result = await runSync(db, pusher);

    expect(result.pushed).toBe(1);
    expect(received).toHaveLength(1);
    expect(await outbox.count()).toBe(0);
  });

  it('oznacza wyslany trening jako zsynchronizowany', async () => {
    const repo = new WorkoutRepository(db);
    await repo.save(makeWorkout('w1'));

    await runSync(db, createPusher().pusher);

    expect(await repo.getUnsynced()).toHaveLength(0);
  });

  it('pusta kolejka nie robi nic', async () => {
    const result = await runSync(db, createPusher().pusher);
    expect(result).toEqual({ pushed: 0, failed: 0, upToDate: true });
  });
});

describe('brak duplikatow', () => {
  it('kilkukrotne uruchomienie synchronizacji wysyla trening TYLKO raz', async () => {
    const repo = new WorkoutRepository(db);
    await repo.save(makeWorkout('w1'));

    const { pusher, received, uniqueIds } = createPusher();

    await runSync(db, pusher);
    await runSync(db, pusher);
    await runSync(db, pusher);

    expect(received).toHaveLength(1);
    expect(uniqueIds()).toBe(1);
  });

  it('ponowny zapis tego samego treningu wysyla go pod tym samym id', async () => {
    const repo = new WorkoutRepository(db);
    const { pusher, received, uniqueIds } = createPusher();

    await repo.save(makeWorkout('w1', 40));
    await runSync(db, pusher);

    // Ten sam trening zapisany ponownie (np. poprawiony) - to wciaz jeden trening.
    await repo.save(makeWorkout('w1', 60));
    await runSync(db, pusher);

    expect(uniqueIds()).toBe(1);
    expect(received[received.length - 1]?.totalReps).toBe(60);
  });

  it('ponowienie po bledzie sieci nie tworzy drugiego treningu', async () => {
    const repo = new WorkoutRepository(db);
    await repo.save(makeWorkout('w1'));

    // Pierwsza proba pada, druga sie udaje.
    const { pusher, received, uniqueIds } = createPusher({ failTimes: 1 });

    const now = 1_000_000;
    const first = await runSync(db, pusher, now);
    expect(first.failed).toBe(1);
    expect(received).toHaveLength(0);

    // Po odczekaniu backoffu wpis wraca do kolejki.
    const second = await runSync(db, pusher, now + 60_000);

    expect(second.pushed).toBe(1);
    expect(uniqueIds()).toBe(1);
  });

  it('kilka roznych treningow trafia na serwer osobno', async () => {
    const repo = new WorkoutRepository(db);
    await repo.save(makeWorkout('w1'));
    await repo.save(makeWorkout('w2'));
    await repo.save(makeWorkout('w3'));

    const { pusher, uniqueIds } = createPusher();
    const result = await runSync(db, pusher);

    expect(result.pushed).toBe(3);
    expect(uniqueIds()).toBe(3);
  });
});

describe('odpornosc na bledy', () => {
  it('nieudany trening zostaje w kolejce', async () => {
    const repo = new WorkoutRepository(db);
    const outbox = new OutboxRepository(db);
    await repo.save(makeWorkout('w1'));

    const { pusher } = createPusher({ failTimes: 5 });
    await runSync(db, pusher, 1_000_000);

    expect(await outbox.count()).toBe(1);
    // Trening nadal jest oznaczony jako niewyslany.
    expect(await repo.getUnsynced()).toHaveLength(1);
  });

  it('blad jednego treningu nie blokuje pozostalych', async () => {
    const repo = new WorkoutRepository(db);
    await repo.save(makeWorkout('w1'));
    await repo.save(makeWorkout('w2'));

    // Pierwsza proba pada, kolejne przechodza.
    const { pusher, received } = createPusher({ failTimes: 1 });
    const result = await runSync(db, pusher);

    expect(result.failed).toBe(1);
    expect(result.pushed).toBe(1);
    expect(received).toHaveLength(1);
  });

  it('nieznany typ wpisu jest usuwany, zeby nie blokowal kolejki', async () => {
    const outbox = new OutboxRepository(db);
    await db.run(
      `INSERT INTO sync_outbox (entity, entity_id, op, payload, attempts, next_attempt_at, created_at)
       VALUES ('cos_nieznanego', 'x', 'upsert', '{}', 0, 0, ?)`,
      [Date.now()],
    );

    await runSync(db, createPusher().pusher);

    expect(await outbox.count()).toBe(0);
  });
});

describe('prywatnosc danych wysylanych na serwer', () => {
  it('wysylany trening zawiera wylacznie liczby i daty', async () => {
    const repo = new WorkoutRepository(db);
    await repo.save(makeWorkout('w1'));

    const { pusher, received } = createPusher();
    await runSync(db, pusher);

    const payload = JSON.stringify(received[0]);

    // Zaden slad po obrazie z kamery nie moze opuscic telefonu.
    expect(payload).not.toMatch(/image|photo|video|frame|base64|jpeg|png|data:/i);

    // Dopuszczamy wylacznie znany zestaw pol.
    expect(Object.keys(received[0] ?? {}).sort()).toEqual([
      'durationS',
      'endedAt',
      'id',
      'localDate',
      'sets',
      'source',
      'startedAt',
      'totalReps',
    ]);
  });
});
