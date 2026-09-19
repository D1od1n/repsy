/**
 * Wybor sterownika lokalnej bazy - wersja telefonowa.
 *
 * Metro podmienia ten plik na openDriver.web.ts, gdy buduje wersje webowa.
 * Dzieki temu reszta warstwy danych (repozytoria, migracje, cala logika)
 * nie wie nic o platformie i jest DOKLADNIE ta sama w obu wersjach.
 */
import { createExpoDriver } from './expoDriver';
import type { SqlDriver } from './driver';

export async function openDriver(): Promise<SqlDriver> {
  return createExpoDriver();
}
