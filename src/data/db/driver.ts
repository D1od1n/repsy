/**
 * Cienka warstwa nad SQLite.
 *
 * Aplikacja na telefonie uzywa expo-sqlite, a testy wbudowanego w Node modulu
 * node:sqlite. Dzieki wspolnemu interfejsowi DOKLADNIE ten sam kod SQL i te same
 * zapytania repozytoriow sa sprawdzane w testach - nie testujemy atrapy.
 */

export type SqlParam = string | number | null;

export interface SqlDriver {
  /** Wykonuje skrypt SQL (moze zawierac wiele instrukcji). */
  exec(sql: string): Promise<void>;
  /** Wykonuje pojedyncza instrukcje zmieniajaca dane. */
  run(sql: string, params?: readonly SqlParam[]): Promise<void>;
  /** Zwraca wszystkie wiersze. */
  all<T>(sql: string, params?: readonly SqlParam[]): Promise<T[]>;
  /** Zwraca pierwszy wiersz albo undefined. */
  get<T>(sql: string, params?: readonly SqlParam[]): Promise<T | undefined>;
  /** Uruchamia funkcje w transakcji (rollback przy bledzie). */
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
