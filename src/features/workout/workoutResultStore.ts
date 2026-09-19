/**
 * Przekazanie wlasnie zakonczonego treningu do ekranu podsumowania.
 *
 * Trzymamy go w malym store zamiast przekazywac przez parametry nawigacji -
 * dzieki temu nie serializujemy calego obiektu do URL-a.
 */
import { create } from 'zustand';

import type { Workout } from '../../core/model';

interface WorkoutResultState {
  result: Workout | null;
  setResult: (workout: Workout | null) => void;
}

export const useWorkoutResultStore = create<WorkoutResultState>((set) => ({
  result: null,
  setResult: (workout) => set({ result: workout }),
}));
