/**
 * Jedno wspolne polaczenie z lokalna baza.
 *
 * Otwieramy je raz i od razu wykonujemy migracje, zeby reszta aplikacji nigdy
 * nie musiala sie zastanawiac, czy schemat jest aktualny.
 */
import { openDriver } from './openDriver';
import type { SqlDriver } from './driver';
import { migrate } from './migrate';

let instance: SqlDriver | null = null;
let opening: Promise<SqlDriver> | null = null;

export async function getDatabase(): Promise<SqlDriver> {
  if (instance !== null) return instance;

  // Kilka rownoleglych wywolan ma dostac to samo polaczenie, a nie otworzyc
  // bazy kilka razy naraz.
  if (opening === null) {
    opening = (async () => {
      const db = await openDriver();
      await migrate(db);
      instance = db;
      return db;
    })();
  }

  return opening;
}

/** Uzywane w testach i przy wylogowaniu. */
export async function closeDatabase(): Promise<void> {
  if (instance !== null) {
    await instance.close();
    instance = null;
    opening = null;
  }
}
