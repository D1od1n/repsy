/**
 * Kolejka zmian czekajacych na wyslanie na serwer (wzorzec outbox).
 *
 * Trening zapisuje sie lokalnie od razu, a tutaj czeka na moment, w ktorym
 * bedzie internet. Nieudana proba nie gubi danych - wpis zostaje w kolejce
 * i jest ponawiany z rosnacym odstepem.
 */
import type { SqlDriver } from '../db/driver';

export interface OutboxItem {
  id: number;
  entity: string;
  entityId: string;
  op: string;
  payload: string;
  attempts: number;
  nextAttemptAt: number;
}

/** Odstepy ponowien: 5 s, 10 s, 20 s, 40 s ... do 30 minut. */
const BASE_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 30 * 60_000;

export class OutboxRepository {
  constructor(private readonly db: SqlDriver) {}

  /** Wpisy gotowe do wyslania (pomija te, ktore czekaja na kolejna probe). */
  async getDue(now: number = Date.now(), limit = 50): Promise<OutboxItem[]> {
    const rows = await this.db.all<{
      id: number;
      entity: string;
      entity_id: string;
      op: string;
      payload: string;
      attempts: number;
      next_attempt_at: number;
    }>(
      `SELECT * FROM sync_outbox
        WHERE next_attempt_at <= ?
        ORDER BY created_at
        LIMIT ?`,
      [now, limit],
    );

    return rows.map((row) => ({
      id: row.id,
      entity: row.entity,
      entityId: row.entity_id,
      op: row.op,
      payload: row.payload,
      attempts: row.attempts,
      nextAttemptAt: row.next_attempt_at,
    }));
  }

  async remove(id: number): Promise<void> {
    await this.db.run('DELETE FROM sync_outbox WHERE id = ?', [id]);
  }

  /** Oznacza nieudana probe i odsuwa kolejna w czasie (backoff wykladniczy). */
  async markFailed(id: number, now: number = Date.now()): Promise<void> {
    const row = await this.db.get<{ attempts: number }>(
      'SELECT attempts FROM sync_outbox WHERE id = ?',
      [id],
    );
    if (row === undefined) return;

    const attempts = row.attempts + 1;
    const delay = Math.min(BASE_BACKOFF_MS * 2 ** (attempts - 1), MAX_BACKOFF_MS);

    await this.db.run('UPDATE sync_outbox SET attempts = ?, next_attempt_at = ? WHERE id = ?', [
      attempts,
      now + delay,
      id,
    ]);
  }

  async count(): Promise<number> {
    const row = await this.db.get<{ total: number }>(
      'SELECT COUNT(*) AS total FROM sync_outbox',
    );
    return row?.total ?? 0;
  }

  async clear(): Promise<void> {
    await this.db.run('DELETE FROM sync_outbox');
  }
}
