/**
 * Uruchamianie synchronizacji.
 *
 * Wysylka to `upsert` po kluczu glownym, wiec powtorzenie jej nigdy nie tworzy
 * drugiego treningu. Serie zapisujemy tak samo - najpierw kasujemy stare,
 * potem wstawiamy aktualne, zeby edycja treningu nie zostawila smieci.
 */
import { create } from 'zustand';

import { getDatabase } from '../../data/db';
import { getSupabase, isBackendConfigured } from '../../data/api/supabase';
import { runSync, type WorkoutPusher } from '../../core/sync/syncEngine';
import { OutboxRepository } from '../../data/repositories/outboxRepository';
import type { Workout } from '../../core/model';

function createSupabasePusher(userId: string): WorkoutPusher {
  return {
    push: async (workout: Workout) => {
      const supabase = getSupabase();
      if (supabase === null) throw new Error('Backend nie jest skonfigurowany');

      const { error: workoutError } = await supabase.from('workouts').upsert(
        {
          id: workout.id,
          user_id: userId,
          local_date: workout.localDate,
          started_at: new Date(workout.startedAt).toISOString(),
          ended_at: new Date(workout.endedAt).toISOString(),
          total_reps: workout.totalReps,
          duration_s: workout.durationS,
          source: workout.source,
        },
        { onConflict: 'id' },
      );
      if (workoutError !== null) throw workoutError;

      await supabase.from('workout_sets').delete().eq('workout_id', workout.id);

      if (workout.sets.length > 0) {
        const { error: setsError } = await supabase.from('workout_sets').insert(
          workout.sets.map((set) => ({
            // Identyfikator serii jest wyprowadzony z id treningu, wiec przy
            // ponownej wysylce powstaje dokladnie ten sam klucz.
            id: deterministicSetId(workout.id, set.index),
            workout_id: workout.id,
            user_id: userId,
            idx: set.index,
            reps: set.reps,
            started_at: new Date(set.startedAt).toISOString(),
            ended_at: new Date(set.endedAt).toISOString(),
          })),
        );
        if (setsError !== null) throw setsError;
      }
    },
  };
}

/**
 * Zamienia ostatnie znaki UUID treningu tak, zeby uzyskac stabilny,
 * unikalny identyfikator serii o poprawnym formacie UUID.
 */
function deterministicSetId(workoutId: string, index: number): string {
  const suffix = index.toString(16).padStart(4, '0');
  return `${workoutId.slice(0, -4)}${suffix}`;
}

interface SyncState {
  syncing: boolean;
  lastError: string | null;
  lastSyncAt: number | null;
  pending: number;

  sync: (userId: string | null) => Promise<void>;
  refreshPending: () => Promise<void>;
}

export const useSyncStore = create<SyncState>((set) => ({
  syncing: false,
  lastError: null,
  lastSyncAt: null,
  pending: 0,

  sync: async (userId) => {
    // Bez konta i bez backendu nie ma dokad wysylac - dane i tak sa bezpieczne
    // lokalnie, wiec po prostu nic nie robimy.
    if (userId === null || !isBackendConfigured()) return;

    set({ syncing: true, lastError: null });
    try {
      const db = await getDatabase();
      const result = await runSync(db, createSupabasePusher(userId));

      set({
        lastSyncAt: Date.now(),
        lastError: result.failed > 0 ? 'errors.syncFailed' : null,
        pending: await new OutboxRepository(db).count(),
      });
    } catch {
      set({ lastError: 'errors.syncFailed' });
    } finally {
      set({ syncing: false });
    }
  },

  refreshPending: async () => {
    const db = await getDatabase();
    set({ pending: await new OutboxRepository(db).count() });
  },
}));
