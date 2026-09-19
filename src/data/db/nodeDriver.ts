/**
 * Sterownik SQLite dla testow (wbudowany w Node modul node:sqlite).
 *
 * UWAGA: tego pliku NIE importuje kod aplikacji - tylko testy. Dzieki temu
 * Metro nigdy nie probuje wciagnac modulu Node do paczki na telefon.
 *
 * Wybralismy node:sqlite zamiast better-sqlite3, bo nie wymaga kompilacji
 * natywnej - a wiec dziala na czystym Windowsie bez narzedzi Visual Studio.
 */
import { DatabaseSync } from 'node:sqlite';

import type { SqlDriver, SqlParam } from './driver';

export function createNodeDriver(path = ':memory:'): SqlDriver {
  const db = new DatabaseSync(path);

  return {
    async exec(sql: string): Promise<void> {
      db.exec(sql);
    },

    async run(sql: string, params: readonly SqlParam[] = []): Promise<void> {
      db.prepare(sql).run(...(params as SqlParam[]));
    },

    async all<T>(sql: string, params: readonly SqlParam[] = []): Promise<T[]> {
      return db.prepare(sql).all(...(params as SqlParam[])) as T[];
    },

    async get<T>(sql: string, params: readonly SqlParam[] = []): Promise<T | undefined> {
      return db.prepare(sql).get(...(params as SqlParam[])) as T | undefined;
    },

    async transaction<T>(fn: () => Promise<T>): Promise<T> {
      db.exec('BEGIN');
      try {
        const result = await fn();
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },

    async close(): Promise<void> {
      db.close();
    },
  };
}
