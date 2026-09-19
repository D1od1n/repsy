/**
 * Uruchamianie migracji.
 *
 * Numer wykonanej wersji trzymamy w PRAGMA user_version - to licznik wbudowany
 * w SQLite, wiec nie potrzebujemy osobnej tabeli ani jej wlasnej migracji.
 */
import type { SqlDriver } from './driver';
import { LATEST_VERSION, MIGRATIONS } from './migrations';

export async function getSchemaVersion(db: SqlDriver): Promise<number> {
  const row = await db.get<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

/**
 * Doprowadza baze do najnowszej wersji. Wielokrotne wywolanie jest bezpieczne -
 * migracje juz wykonane sa pomijane.
 */
export async function migrate(db: SqlDriver): Promise<number> {
  await db.exec('PRAGMA foreign_keys = ON;');

  const current = await getSchemaVersion(db);
  const pending = MIGRATIONS.filter((m) => m.version > current).sort(
    (a, b) => a.version - b.version,
  );

  for (const migration of pending) {
    await db.transaction(async () => {
      await db.exec(migration.sql);
      // PRAGMA nie przyjmuje parametrow, ale numer wersji pochodzi z naszego
      // kodu (a nie od uzytkownika), wiec wstawienie go wprost jest bezpieczne.
      await db.exec(`PRAGMA user_version = ${migration.version};`);
    });
  }

  return LATEST_VERSION;
}
