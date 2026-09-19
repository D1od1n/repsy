/**
 * Znajomi i ranking.
 *
 * Wszystkie operacje ida przez funkcje RPC z SECURITY DEFINER, ktore zwracaja
 * tylko to, co konieczne (id, nazwa, awatar, suma powtorzen). Klient nie ma
 * bezposredniego dostepu do tabeli profili innych osob.
 */
import { getSupabase } from './supabase';
import type { Friend, LeaderboardEntry } from '../../core/model';
import type { LocalDate } from '../../core/date/localDate';

interface ProfileRef {
  id: string;
  username: string;
  avatar_emoji: string;
}

/**
 * Supabase zwraca zagniezdzone relacje raz jako obiekt, a raz jako tablice -
 * zaleznie od tego, czy potrafi jednoznacznie okreslic licznosc powiazania.
 * Ta funkcja sprowadza oba ksztalty do jednego.
 */
function firstOf(value: ProfileRef | ProfileRef[] | null | undefined): ProfileRef | null {
  if (value === null || value === undefined) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export interface FriendRequest {
  id: string;
  direction: 'incoming' | 'outgoing';
  userId: string;
  username: string;
  avatarEmoji: string;
}

export type AddFriendResult = 'sent' | 'accepted' | 'already_friends' | 'self' | 'not_found';

export async function findUser(query: string): Promise<Friend | null> {
  const supabase = getSupabase();
  if (supabase === null) return null;

  const { data, error } = await supabase.rpc('find_user', { p_query: query.trim() });
  if (error !== null) throw error;

  const rows = (data ?? []) as ProfileRef[];
  const row = rows[0];
  return row === undefined
    ? null
    : { id: row.id, username: row.username, avatarEmoji: row.avatar_emoji };
}

/** Wyszukuje po nazwie albo kodzie i od razu wysyla zaproszenie. */
export async function addFriend(query: string): Promise<AddFriendResult> {
  const supabase = getSupabase();
  if (supabase === null) return 'not_found';

  const user = await findUser(query);
  if (user === null) return 'not_found';

  const { data, error } = await supabase.rpc('send_friend_request', { p_target: user.id });
  if (error !== null) throw error;

  return (data as AddFriendResult | null) ?? 'sent';
}

export async function listFriends(): Promise<Friend[]> {
  const supabase = getSupabase();
  if (supabase === null) return [];

  const { data, error } = await supabase
    .from('friendships')
    .select('friend:profiles!friendships_friend_id_fkey(id, username, avatar_emoji)');

  if (error !== null) throw error;

  const rows = (data ?? []) as unknown as { friend: ProfileRef | ProfileRef[] | null }[];

  return rows
    .map((row) => firstOf(row.friend))
    .filter((friend): friend is ProfileRef => friend !== null)
    .map((friend) => ({
      id: friend.id,
      username: friend.username,
      avatarEmoji: friend.avatar_emoji,
    }));
}

export async function listRequests(currentUserId: string): Promise<FriendRequest[]> {
  const supabase = getSupabase();
  if (supabase === null) return [];

  const { data, error } = await supabase
    .from('friend_requests')
    .select(
      'id, from_user, to_user, status, sender:profiles!friend_requests_from_user_fkey(id, username, avatar_emoji), recipient:profiles!friend_requests_to_user_fkey(id, username, avatar_emoji)',
    )
    .eq('status', 'pending');

  if (error !== null) throw error;

  type Row = {
    id: string;
    from_user: string;
    to_user: string;
    sender: ProfileRef | ProfileRef[] | null;
    recipient: ProfileRef | ProfileRef[] | null;
  };

  return ((data ?? []) as unknown as Row[])
    .map((row) => {
      const incoming = row.to_user === currentUserId;
      const other = firstOf(incoming ? row.sender : row.recipient);
      if (other === null) return null;

      return {
        id: row.id,
        direction: incoming ? ('incoming' as const) : ('outgoing' as const),
        userId: other.id,
        username: other.username,
        avatarEmoji: other.avatar_emoji,
      };
    })
    .filter((request): request is FriendRequest => request !== null);
}

export async function respondToRequest(requestId: string, accept: boolean): Promise<void> {
  const supabase = getSupabase();
  if (supabase === null) return;

  const { error } = await supabase.rpc('respond_friend_request', {
    p_request: requestId,
    p_accept: accept,
  });
  if (error !== null) throw error;
}

export async function removeFriend(friendId: string): Promise<void> {
  const supabase = getSupabase();
  if (supabase === null) return;

  const { error } = await supabase.rpc('remove_friend', { p_friend: friendId });
  if (error !== null) throw error;
}

/**
 * Ranking za podany zakres dni.
 * Zakres wyliczamy na telefonie w lokalnej strefie czasowej, zeby "dzis"
 * znaczylo dzis u uzytkownika, a nie w strefie serwera.
 */
export async function fetchLeaderboard(
  from: LocalDate,
  to: LocalDate,
  currentUserId: string,
): Promise<LeaderboardEntry[]> {
  const supabase = getSupabase();
  if (supabase === null) return [];

  const { data, error } = await supabase.rpc('friends_leaderboard', {
    p_from: from,
    p_to: to,
  });
  if (error !== null) throw error;

  const rows = (data ?? []) as {
    user_id: string;
    username: string;
    avatar_emoji: string;
    total: number;
  }[];

  return rows.map((row) => ({
    userId: row.user_id,
    username: row.username,
    avatarEmoji: row.avatar_emoji,
    total: Number(row.total),
    isMe: row.user_id === currentUserId,
  }));
}
