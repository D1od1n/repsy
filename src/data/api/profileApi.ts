/**
 * Profil uzytkownika po stronie serwera.
 */
import { getSupabase } from './supabase';
import type { Profile } from '../../core/model';

interface ProfileRow {
  id: string;
  username: string;
  friend_code: string;
  avatar_emoji: string;
  default_goal: number;
}

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    username: row.username,
    friendCode: row.friend_code,
    avatarEmoji: row.avatar_emoji,
    defaultGoal: row.default_goal,
  };
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const supabase = getSupabase();
  if (supabase === null) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, friend_code, avatar_emoji, default_goal')
    .eq('id', userId)
    .maybeSingle();

  if (error !== null) throw error;
  return data === null ? null : toProfile(data as ProfileRow);
}

/**
 * Rezerwuje nazwe uzytkownika. Zwraca `null`, gdy nazwa jest juz zajeta.
 * Unikalnosc pilnuje baza (indeks unique), a nie sprawdzenie w aplikacji -
 * dzieki temu dwie osoby nie zajma tej samej nazwy w tej samej chwili.
 */
export async function claimUsername(
  _userId: string,
  username: string,
): Promise<Profile | null> {
  const supabase = getSupabase();
  if (supabase === null) return null;

  const { data, error } = await supabase.rpc('claim_username', { p_username: username });

  if (error !== null) {
    // Kolizja unikalnosci oznacza po prostu zajeta nazwe.
    if (error.code === '23505') return null;
    throw error;
  }

  return data === null ? null : toProfile(data as ProfileRow);
}

export async function updateDefaultGoal(goal: number): Promise<void> {
  const supabase = getSupabase();
  if (supabase === null) return;

  const { error } = await supabase.auth.getUser();
  if (error !== null) return;

  await supabase
    .from('profiles')
    .update({ default_goal: goal, updated_at: new Date().toISOString() })
    .eq('id', (await supabase.auth.getUser()).data.user?.id ?? '');
}
