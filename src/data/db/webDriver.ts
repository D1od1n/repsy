/**
 * Sterownik lokalnej bazy danych dla przegladarki (SQLite przez sql.js).
 *
 * ===================== DLACZEGO NIE expo-sqlite NA WEBIE =====================
 * expo-sqlite ma implementacje webowa, ale opiera sie ona na SharedArrayBuffer
 * i Atomics (patrz node_modules/expo-sqlite/web/WorkerChannel.ts) - tak
 * realizuje synchroniczne API ponad granica Web Workera.
 *
 * SharedArrayBuffer wymaga izolacji cross-origin, czyli naglowkow HTTP:
 *     Cross-Origin-Opener-Policy: same-origin
 *     Cross-Origin-Embedder-Policy: require-corp
 *
 * GitHub Pages NIE POZWALA ustawiac naglowkow. Efekt, sprawdzony na zywo:
 * SharedArrayBuffer w ogole nie istnieje, worker bazy nie odpowiada, a cala
 * aplikacja zatrzymuje sie na ekranie ladowania - bez jednego bledu w konsoli.
 * Blad tym grozniejszy, ze build konczy sie sukcesem.
 *
 * sql.js to ta sama baza SQLite skompilowana do WebAssembly, ale dzialajaca
 * synchronicznie na glownym watku. Nie potrzebuje zadnych naglowkow, wiec
 * dziala na dowolnym hostingu plikow statycznych.
 * =============================================================================
 *
 * ============================== PRYWATNOSC ==============================
 * Tu leza wylacznie wyniki: powtorzenia, serie, daty, cele, ustawienia.
 * Zadnych klatek, zdjec ani nagran - schemat bazy nie ma nawet kolumny,
 * w ktorej moglyby sie znalezc (pilnuje tego test privacy.test.ts).
 * ========================================================================
 *
 * Trwalosc: sql.js trzyma cala baze w pamieci, wiec po kazdym zapisie
 * zrzucamy ja do IndexedDB. Zapis jest opozniony (debounce), zeby seria
 * powtorzen w trakcie treningu nie wywolala kilkudziesieciu zrzutow -
 * i dodatkowo wymuszany przy chowaniu karty, zeby nic nie przepadlo.
 */
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';

import type { SqlDriver, SqlParam } from './driver';
import { assetUrl } from '../../features/web/basePath';

const DB_NAME = 'repsy';
const STORE_NAME = 'sqlite';
const RECORD_KEY = 'main';

/** Ile czekamy z zapisem po ostatniej zmianie. */
const PERSIST_DELAY_MS = 400;

// --------------------------------------------------------------- IndexedDB

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Nie udalo sie otworzyc IndexedDB'));
  });
}

async function readSnapshot(): Promise<Uint8Array | null> {
  try {
    const idb = await openIdb();
    return await new Promise<Uint8Array | null>((resolve) => {
      const tx = idb.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(RECORD_KEY);
      request.onsuccess = () => {
        const value: unknown = request.result;
        resolve(value instanceof Uint8Array ? value : null);
      };
      request.onerror = () => resolve(null);
      tx.oncomplete = () => idb.close();
    });
  } catch {
    // Tryb prywatny albo zablokowane dane witryn: startujemy z pusta baza.
    // Aplikacja bedzie dzialac, tylko nie zapamieta wynikow miedzy wizytami.
    return null;
  }
}

async function writeSnapshot(bytes: Uint8Array): Promise<void> {
  try {
    const idb = await openIdb();
    await new Promise<void>((resolve) => {
      const tx = idb.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(bytes, RECORD_KEY);
      tx.oncomplete = () => {
        idb.close();
        resolve();
      };
      tx.onerror = () => {
        idb.close();
        resolve();
      };
    });
  } catch {
    // Brak miejsca albo zablokowany magazyn - nie przerywamy pracy aplikacji.
  }
}

// ------------------------------------------------------------------ silnik

let sqlJs: SqlJsStatic | null = null;

async function loadSqlJs(): Promise<SqlJsStatic> {
  if (sqlJs !== null) return sqlJs;

  sqlJs = await initSqlJs({
    // Plik .wasm serwujemy z wlasnego katalogu public/ - dzieki temu dziala
    // offline i nie trzeba otwierac CSP na obca domene.
    locateFile: (file: string) => assetUrl(`sql/${file}`),
  });
  return sqlJs;
}

export async function createWebDriver(): Promise<SqlDriver> {
  const SQL = await loadSqlJs();

  const snapshot = await readSnapshot();
  const db: Database = snapshot === null ? new SQL.Database() : new SQL.Database(snapshot);

  // Klucze obce nie sa w SQLite wlaczone domyslnie.
  db.run('PRAGMA foreign_keys = ON;');

  let persistTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const persistNow = async (): Promise<void> => {
    if (closed) return;
    if (persistTimer !== null) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    await writeSnapshot(db.export());
  };

  const schedulePersist = (): void => {
    if (closed) return;
    if (persistTimer !== null) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      persistTimer = null;
      void writeSnapshot(db.export());
    }, PERSIST_DELAY_MS);
  };

  // Zamkniecie karty w trakcie oczekiwania na zapis nie moze zgubic danych.
  // 'pagehide' jest pewniejsze niz 'beforeunload' na urzadzeniach mobilnych.
  const flush = (): void => {
    if (persistTimer === null || closed) return;
    clearTimeout(persistTimer);
    persistTimer = null;
    void writeSnapshot(db.export());
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
  }

  /** Zamienia parametry na typy akceptowane przez sql.js. */
  const bindable = (params: readonly SqlParam[] = []): (string | number | null)[] => [...params];

  const query = <T,>(sql: string, params: readonly SqlParam[] = [], limitOne: boolean): T[] => {
    const statement = db.prepare(sql);
    try {
      statement.bind(bindable(params));
      const rows: T[] = [];
      while (statement.step()) {
        rows.push(statement.getAsObject() as T);
        if (limitOne) break;
      }
      return rows;
    } finally {
      // Bez zwolnienia zapytania sql.js gubi pamiec przy kazdym wywolaniu.
      statement.free();
    }
  };

  return {
    async exec(sql: string): Promise<void> {
      db.run(sql);
      schedulePersist();
    },

    async run(sql: string, params?: readonly SqlParam[]): Promise<void> {
      db.run(sql, bindable(params));
      schedulePersist();
    },

    async all<T>(sql: string, params?: readonly SqlParam[]): Promise<T[]> {
      return query<T>(sql, params, false);
    },

    async get<T>(sql: string, params?: readonly SqlParam[]): Promise<T | undefined> {
      return query<T>(sql, params, true)[0];
    },

    async transaction<T>(fn: () => Promise<T>): Promise<T> {
      db.run('BEGIN');
      try {
        const result = await fn();
        db.run('COMMIT');
        schedulePersist();
        return result;
      } catch (error) {
        // Wycofanie moze samo rzucic, gdy transakcja juz nie istnieje -
        // wtedy wazniejszy jest pierwotny blad, wiec go nie przyslaniamy.
        try {
          db.run('ROLLBACK');
        } catch {
          /* pusto celowo */
        }
        throw error;
      }
    },

    async close(): Promise<void> {
      await persistNow();
      closed = true;
      if (typeof window !== 'undefined') window.removeEventListener('pagehide', flush);
      db.close();
    },
  };
}
