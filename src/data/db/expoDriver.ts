/**
 * Sterownik SQLite dzialajacy na telefonie (expo-sqlite).
 *
 * Uzywamy wylacznie API asynchronicznego, zeby zapisy nie blokowaly watku JS -
 * podczas treningu na tym samym watku dziala licznik i interfejs.
 */
import * as SQLite from 'expo-sqlite';

import type { SqlDriver, SqlParam } from './driver';

export const DATABASE_NAME = 'repsy.db';

export async function createExpoDriver(name: string = DATABASE_NAME): Promise<SqlDriver> {
  const db = await SQLite.openDatabaseAsync(name);

  return {
    async exec(sql: string): Promise<void> {
      await db.execAsync(sql);
    },

    async run(sql: string, params: readonly SqlParam[] = []): Promise<void> {
      await db.runAsync(sql, ...(params as SqlParam[]));
    },

    async all<T>(sql: string, params: readonly SqlParam[] = []): Promise<T[]> {
      return (await db.getAllAsync(sql, ...(params as SqlParam[]))) as T[];
    },

    async get<T>(sql: string, params: readonly SqlParam[] = []): Promise<T | undefined> {
      const row = await db.getFirstAsync(sql, ...(params as SqlParam[]));
      return (row ?? undefined) as T | undefined;
    },

    async transaction<T>(fn: () => Promise<T>): Promise<T> {
      let result!: T;
      await db.withTransactionAsync(async () => {
        result = await fn();
      });
      return result;
    },

    async close(): Promise<void> {
      await db.closeAsync();
    },
  };
}
