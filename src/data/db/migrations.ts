/**
 * Migracje lokalnej bazy danych.
 *
 * Numerowane i wykonywane po kolei; aktualny numer trzymamy w PRAGMA user_version.
 * Migracji NIGDY nie edytujemy po wydaniu - dopisujemy nowa, inaczej telefony,
 * ktore juz wykonaly stara wersje, rozjada sie z tymi po swiezej instalacji.
 *
 * ============================ PRYWATNOSC ============================
 * W schemacie nie ma ani jednej kolumny na obraz, klatke, nagranie czy sciezke
 * do pliku multimedialnego. Zapisujemy wylacznie liczby i daty.
 * ====================================================================
 */

export interface Migration {
  version: number;
  sql: string;
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE workouts (
        id           TEXT PRIMARY KEY,
        local_date   TEXT    NOT NULL,
        started_at   INTEGER NOT NULL,
        ended_at     INTEGER NOT NULL,
        total_reps   INTEGER NOT NULL,
        duration_s   INTEGER NOT NULL,
        source       TEXT    NOT NULL DEFAULT 'camera',
        synced_at    INTEGER,
        updated_at   INTEGER NOT NULL
      );
      CREATE INDEX idx_workouts_local_date ON workouts(local_date);
      CREATE INDEX idx_workouts_unsynced   ON workouts(synced_at);

      CREATE TABLE workout_sets (
        id          TEXT PRIMARY KEY,
        workout_id  TEXT    NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
        idx         INTEGER NOT NULL,
        reps        INTEGER NOT NULL,
        started_at  INTEGER NOT NULL,
        ended_at    INTEGER NOT NULL
      );
      CREATE INDEX idx_sets_workout ON workout_sets(workout_id);

      -- Cel ustawiony na konkretny dzien. Brak wiersza = obowiazuje cel domyslny.
      CREATE TABLE daily_goals (
        local_date  TEXT PRIMARY KEY,
        goal        INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
      );

      -- Ustawienia uzytkownika jako pary klucz-wartosc (zostaja na urzadzeniu).
      CREATE TABLE settings (
        key    TEXT PRIMARY KEY,
        value  TEXT NOT NULL
      );

      CREATE TABLE reminders (
        id              TEXT PRIMARY KEY,
        hour            INTEGER NOT NULL,
        minute          INTEGER NOT NULL,
        enabled         INTEGER NOT NULL DEFAULT 1,
        custom_message  TEXT    NOT NULL DEFAULT ''
      );

      -- Kolejka zmian czekajacych na wyslanie na serwer.
      -- UNIQUE sprawia, ze ponowny zapis tego samego treningu nadpisuje wpis,
      -- zamiast dokladac kolejny - to pierwsza z dwoch barier przeciw duplikatom.
      CREATE TABLE sync_outbox (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        entity           TEXT    NOT NULL,
        entity_id        TEXT    NOT NULL,
        op               TEXT    NOT NULL,
        payload          TEXT    NOT NULL,
        attempts         INTEGER NOT NULL DEFAULT 0,
        next_attempt_at  INTEGER NOT NULL DEFAULT 0,
        created_at       INTEGER NOT NULL,
        UNIQUE(entity, entity_id, op)
      );

      -- Kopia listy znajomych, zeby ekran dzialal takze bez internetu.
      CREATE TABLE friends_cache (
        id            TEXT PRIMARY KEY,
        username      TEXT NOT NULL,
        avatar_emoji  TEXT NOT NULL DEFAULT '',
        updated_at    INTEGER NOT NULL
      );

      -- Kopia rankingu: klucz to okres (today/week/month).
      CREATE TABLE leaderboard_cache (
        period      TEXT NOT NULL,
        user_id     TEXT NOT NULL,
        username    TEXT NOT NULL,
        avatar_emoji TEXT NOT NULL DEFAULT '',
        total       INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL,
        PRIMARY KEY (period, user_id)
      );
    `,
  },
];

export const LATEST_VERSION = MIGRATIONS.reduce(
  (max, migration) => Math.max(max, migration.version),
  0,
);
