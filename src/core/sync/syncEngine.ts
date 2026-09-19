/**
 * Silnik synchronizacji (offline-first).
 *
 * Zasada: zrodlem prawdy jest telefon. Trening zapisuje sie lokalnie od razu,
 * a do serwera trafia przy najblizszej okazji z kolejki (outbox).
 *
 * BRAK DUPLIKATOW opiera sie na dwoch niezaleznych barierach:
 *   1. identyfikator treningu powstaje na telefonie, a wysylka to upsert po
 *      kluczu glownym - ponowne wyslanie trafia w ten sam wiersz,
 *   2. kolejka ma UNIQUE(entity, entity_id, op), wiec ten sam trening nie
 *      moze staс w niej dwa razy.
 *
 * Wysylka jest wiec bezpieczna do powtorzenia dowolna liczbe razy.
 *
 * Funkcja przyjmuje `pusher` jako argument - dzieki temu testy sprawdzaja
 * prawdziwa logike kolejki i ponowien, bez zadnego polaczenia z siecia.
 */
import type { SqlDriver } from '../../data/db/driver';
import { OutboxRepository } from '../../data/repositories/outboxRepository';
import { WorkoutRepository } from '../../data/repositories/workoutRepository';
import type { Workout } from '../model';

export interface WorkoutPusher {
  /** Wysyla trening na serwer. Rzuca wyjatek, gdy sie nie uda. */
  push: (workout: Workout) => Promise<void>;
}

export interface SyncResult {
  pushed: number;
  failed: number;
  /** true, gdy nie bylo nic do wyslania. */
  upToDate: boolean;
}

export async function runSync(
  db: SqlDriver,
  pusher: WorkoutPusher,
  now: number = Date.now(),
): Promise<SyncResult> {
  const outbox = new OutboxRepository(db);
  const workouts = new WorkoutRepository(db);

  const items = await outbox.getDue(now);
  if (items.length === 0) return { pushed: 0, failed: 0, upToDate: true };

  let pushed = 0;
  let failed = 0;

  for (const item of items) {
    if (item.entity !== 'workout') {
      // Nieznany typ wpisu - usuwamy, zeby nie blokowal kolejki w nieskonczonosc.
      await outbox.remove(item.id);
      continue;
    }

    try {
      const workout = JSON.parse(item.payload) as Workout;
      await pusher.push(workout);

      await outbox.remove(item.id);
      await workouts.markSynced([workout.id], now);
      pushed += 1;
    } catch {
      // Zostawiamy w kolejce i odsuwamy kolejna probe - dane nie gina.
      await outbox.markFailed(item.id, now);
      failed += 1;
    }
  }

  return { pushed, failed, upToDate: false };
}
