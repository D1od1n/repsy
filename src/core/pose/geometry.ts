/** Podstawowe operacje geometryczne na punktach ciala. */
import type { Keypoint } from './types';

export interface Point {
  x: number;
  y: number;
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Kat w wierzcholku `vertex` miedzy ramionami do `a` i `b`, w stopniach (0..180).
 * Uzywany do kata lokcia: vertex = lokiec, a = bark, b = nadgarstek.
 */
export function angleDegrees(a: Point, vertex: Point, b: Point): number {
  const v1x = a.x - vertex.x;
  const v1y = a.y - vertex.y;
  const v2x = b.x - vertex.x;
  const v2y = b.y - vertex.y;

  const mag1 = Math.hypot(v1x, v1y);
  const mag2 = Math.hypot(v2x, v2y);
  if (mag1 === 0 || mag2 === 0) return 0;

  const cos = (v1x * v2x + v1y * v2y) / (mag1 * mag2);
  return (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Mediana - odporna na pojedyncze odstajace probki, w przeciwienstwie do sredniej. */
export function median(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

export function isKeypointConfident(kp: Keypoint, minScore: number): boolean {
  return kp.score >= minScore;
}
