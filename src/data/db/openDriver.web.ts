/**
 * Wybor sterownika lokalnej bazy - wersja przegladarkowa.
 *
 * Powod, dla ktorego nie uzywamy tu expo-sqlite, jest opisany szczegolowo
 * w naglowku webDriver.ts (w skrocie: wymaga SharedArrayBuffer, czyli
 * naglowkow HTTP, ktorych GitHub Pages nie potrafi ustawic).
 */
import { createWebDriver } from './webDriver';
import type { SqlDriver } from './driver';

export async function openDriver(): Promise<SqlDriver> {
  return createWebDriver();
}
