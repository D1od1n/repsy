/**
 * Zapis i odczyt treningow z lokalnej bazy.
 *
 * Zasada offline-first: trening zapisuje sie NAJPIERW lokalnie i dopiero potem
 * trafia do kolejki wysylki. Brak internetu nie przeszkadza w trenowaniu.
 *
 * Zapis jest idempotentny - ten sam identyfikator zawsze nadpisuje ten sam
 * wiersz, nigdy nie tworzy drugiego. To pierwsza z dwoch barier chroniacych
 * przed duplikatami (druga jest upsert po stronie serwera).
 */
import type { SqlDriver } from '../db/driver';
import type { LocalDate } from '../../core/date/localDate';
import type { Workout, WorkoutSet, WorkoutSource } from '../../core/model';

interface WorkoutRow {
  id: string;
  local_date: string;
  started_at: number;
  ended_at: number;
  total_reps: number;
  duration_s: number;
  source: string;
  synced_at: number | null;
}

interface SetRow {
  id: string;
  workout_id: string;
  idx: number;
  reps: number;
  started_at: number;
  ended_at: number;
}

export class WorkoutRepository {
  constructor(private readonly db: SqlDriver) {}

  /** Zapisuje trening wraz z seriami i kolejkuje go do wysylki. */
  async save(workout: Workout): Promise<void> {
    await this.db.transaction(async () => {
      await this.db.run(
        `INSERT INTO workouts
           (id, local_date, started_at, ended_at, total_reps, duration_s, source, synced_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)
         ON CONFLICT(id) DO UPDATE SET
           local_date = excluded.local_date,
           started_at = excluded.started_at,
           ended_at   = excluded.ended_at,
           total_reps = excluded.total_reps,
           duration_s = excluded.duration_s,
           source     = excluded.source,
           synced_at  = NULL,
           updated_at = excluded.updated_at`,
        [
          workout.id,
          workout.localDate,
          workout.startedAt,
          workout.endedAt,
          workout.totalReps,
          workout.durationS,
          workout.source,
          Date.now(),
        ],
      );

      // Serie zapisujemy od nowa - dzieki temu ponowny zapis tego samego
      // treningu nie zostawia starych, nieaktualnych serii.
      await this.db.run('DELETE FROM workout_sets WHERE workout_id = ?', [workout.id]);

      for (const set of workout.sets) {
        await this.db.run(
          `INSERT INTO workout_sets (id, workout_id, idx, reps, started_at, ended_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            `${workout.id}:${set.index}`,
            workout.id,
            set.index,
            set.reps,
            set.startedAt,
            set.endedAt,
          ],
        );
      }

      await this.enqueue(workout);
    });
  }

  /** Dokłada trening do kolejki wysylki (UNIQUE w tabeli zapobiega duplikatom). */
  private async enqueue(workout: Workout): Promise<void> {
    await this.db.run(
      `INSERT INTO sync_outbox (entity, entity_id, op, payload, attempts, next_attempt_at, created_at)
       VALUES ('workout', ?, 'upsert', ?, 0, 0, ?)
       ON CONFLICT(entity, entity_id, op) DO UPDATE SET
         payload         = excluded.payload,
         attempts        = 0,
         next_attempt_at = 0`,
      [workout.id, JSON.stringify(workout), Date.now()],
    );
  }

  async getByDate(date: LocalDate): Promise<Workout[]> {
    return this.query('WHERE local_date = ?', [date]);
  }

  async getRange(from: LocalDate, to: LocalDate): Promise<Workout[]> {
    return this.query('WHERE local_date >= ? AND local_date <= ?', [from, to]);
  }

  async getAll(): Promise<Workout[]> {
    return this.query('', []);
  }

  async getById(id: string): Promise<Workout | undefined> {
    const rows = await this.query('WHERE id = ?', [id]);
    return rows[0];
  }

  async getUnsynced(): Promise<Workout[]> {
    return this.query('WHERE synced_at IS NULL', []);
  }

  async markSynced(ids: readonly string[], at: number = Date.now()): Promise<void> {
    for (const id of ids) {
      await this.db.run('UPDATE workouts SET synced_at = ? WHERE id = ?', [at, id]);
    }
  }

  async deleteById(id: string): Promise<void> {
    await this.db.transaction(async () => {
      await this.db.run('DELETE FROM workout_sets WHERE workout_id = ?', [id]);
      await this.db.run('DELETE FROM workouts WHERE id = ?', [id]);
      await this.db.run(
        "DELETE FROM sync_outbox WHERE entity = 'workout' AND entity_id = ?",
        [id],
      );
    });
  }

  /** Wszystkie daty, w ktorych byl jakikolwiek trening - podstawa do streaka. */
  async getDatesWithTotals(): Promise<{ date: LocalDate; totalReps: number }[]> {
    const rows = await this.db.all<{ local_date: string; total: number }>(
      `SELECT local_date, SUM(total_reps) AS total
         FROM workouts
        GROUP BY local_date
        ORDER BY local_date`,
    );
    return rows.map((row) => ({ date: row.local_date, totalReps: row.total }));
  }

  private async query(where: string, params: readonly (string | number)[]): Promise<Workout[]> {
    const workoutRows = await this.db.all<WorkoutRow>(
      `SELECT * FROM workouts ${where} ORDER BY started_at`,
      params,
    );
    if (workoutRows.length === 0) return [];

    const ids = workoutRows.map((row) => row.id);
    const placeholders = ids.map(() => '?').join(', ');
    const setRows = await this.db.all<SetRow>(
      `SELECT * FROM workout_sets WHERE workout_id IN (${placeholders}) ORDER BY idx`,
      ids,
    );

    const setsByWorkout = new Map<string, WorkoutSet[]>();
    for (const row of setRows) {
      const list = setsByWorkout.get(row.workout_id) ?? [];
      list.push({
        index: row.idx,
        reps: row.reps,
        startedAt: row.started_at,
        endedAt: row.ended_at,
      });
      setsByWorkout.set(row.workout_id, list);
    }

    return workoutRows.map((row) => ({
      id: row.id,
      localDate: row.local_date,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      totalReps: row.total_reps,
      durationS: row.duration_s,
      source: row.source as WorkoutSource,
      sets: setsByWorkout.get(row.id) ?? [],
    }));
  }
}
