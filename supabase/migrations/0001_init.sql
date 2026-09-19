-- =============================================================================
-- Repsy - schemat bazy danych (Supabase / PostgreSQL)
-- =============================================================================
--
-- PRYWATNOSC: w calym schemacie nie ma ani jednej kolumny na obraz, klatke czy
-- nagranie. Na serwer trafiaja wylacznie liczby i daty.
--
-- BEZPIECZENSTWO opiera sie na trzech filarach:
--   1. RLS - kazdy widzi tylko swoje dane i wyniki znajomych.
--   2. daily_stats liczy WYLACZNIE serwer (trigger). Klient nie ma zadnej
--      polityki zapisu na tej tabeli, wiec nie wpisze sobie wyniku do rankingu.
--   3. Walidacja wiarygodnosci treningow (tempo, limity, daty z przyszlosci).
--
-- Uruchomienie: skopiuj cala zawartosc do SQL Editor w panelu Supabase
-- i kliknij Run. Szczegoly w README.
-- =============================================================================

create extension if not exists citext;
create extension if not exists pgcrypto;

-- =============================================================================
-- TABELE
-- =============================================================================

create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      citext not null unique,
  friend_code   text   not null unique,
  avatar_emoji  text   not null default '💪',
  default_goal  int    not null default 100 check (default_goal between 1 and 2000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint username_format check (username ~ '^[A-Za-z0-9._]{3,20}$')
);

create table if not exists public.workouts (
  -- Identyfikator pochodzi z telefonu. To on sprawia, ze ponowne wyslanie
  -- tego samego treningu trafia w ten sam wiersz i nie tworzy duplikatu.
  id          uuid primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  local_date  date not null,
  started_at  timestamptz not null,
  ended_at    timestamptz not null,
  total_reps  int  not null check (total_reps >= 0 and total_reps <= 2000),
  duration_s  int  not null check (duration_s >= 0 and duration_s <= 43200),
  source      text not null default 'camera' check (source in ('camera', 'manual')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint workout_time_order check (ended_at >= started_at)
);

create index if not exists workouts_user_date_idx on public.workouts (user_id, local_date);

create table if not exists public.workout_sets (
  id          uuid primary key,
  workout_id  uuid not null references public.workouts(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  idx         int  not null check (idx > 0),
  reps        int  not null check (reps >= 0 and reps <= 500),
  started_at  timestamptz not null,
  ended_at    timestamptz not null,
  unique (workout_id, idx)
);

create index if not exists workout_sets_workout_idx on public.workout_sets (workout_id);

-- Cel ustawiony na konkretny dzien (wyjatek od celu domyslnego).
create table if not exists public.daily_goals (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  local_date  date not null,
  goal        int  not null check (goal between 1 and 2000),
  updated_at  timestamptz not null default now(),
  primary key (user_id, local_date)
);

-- Tabela wyliczana przez serwer. Klient NIGDY jej nie zapisuje.
create table if not exists public.daily_stats (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  local_date  date not null,
  total_reps  int  not null default 0,
  workouts    int  not null default 0,
  sets        int  not null default 0,
  goal        int  not null default 100,
  achieved    boolean not null default false,
  updated_at  timestamptz not null default now(),
  primary key (user_id, local_date)
);

create index if not exists daily_stats_date_idx on public.daily_stats (local_date);

-- Znajomosc jest symetryczna i zapisywana jako dwa wiersze - dzieki temu
-- zapytania "moi znajomi" sa proste i szybkie.
create table if not exists public.friendships (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  friend_id  uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  constraint no_self_friendship check (user_id <> friend_id)
);

create table if not exists public.friend_requests (
  id         uuid primary key default gen_random_uuid(),
  from_user  uuid not null references public.profiles(id) on delete cascade,
  to_user    uuid not null references public.profiles(id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (from_user, to_user),
  constraint no_self_request check (from_user <> to_user)
);

-- =============================================================================
-- WIARYGODNOSC DANYCH (podstawowy anty-cheat)
-- =============================================================================
--
-- Nie zakladamy, ze klient jest uczciwy. To nie jest pelny system anty-cheat -
-- przy kamerze na wlasnym telefonie nie da sie go zbudowac - ale odrzuca
-- oczywiste probki niemozliwych wynikow.

create or replace function public.validate_workout()
returns trigger
language plpgsql
as $$
declare
  v_day_total int;
begin
  if new.started_at > now() + interval '5 minutes' then
    raise exception 'Trening nie moze zaczynac sie w przyszlosci';
  end if;

  -- Tempo szybsze niz 0,4 s na powtorzenie jest fizycznie niemozliwe.
  -- Wpisy reczne pomijamy - tam czas trwania z zalozenia wynosi 0.
  if new.source = 'camera' and new.total_reps > 0 and new.duration_s > 0
     and (new.duration_s::numeric / new.total_reps) < 0.4 then
    raise exception 'Niewiarygodne tempo treningu';
  end if;

  select coalesce(sum(total_reps), 0) into v_day_total
  from public.workouts
  where user_id = new.user_id and local_date = new.local_date and id <> new.id;

  if v_day_total + new.total_reps > 5000 then
    raise exception 'Przekroczony dzienny limit powtorzen';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists workouts_validate on public.workouts;
create trigger workouts_validate
  before insert or update on public.workouts
  for each row execute function public.validate_workout();

-- =============================================================================
-- STATYSTYKI DZIENNE LICZONE PRZEZ SERWER
-- =============================================================================

create or replace function public.recompute_daily_stats(p_user uuid, p_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_goal  int;
  v_reps  int;
  v_count int;
  v_sets  int;
begin
  select coalesce(
    (select goal from daily_goals where user_id = p_user and local_date = p_date),
    (select default_goal from profiles where id = p_user),
    100
  ) into v_goal;

  select coalesce(sum(total_reps), 0), count(*)
    into v_reps, v_count
  from workouts
  where user_id = p_user and local_date = p_date;

  select count(*) into v_sets
  from workout_sets s
  join workouts w on w.id = s.workout_id
  where w.user_id = p_user and w.local_date = p_date;

  insert into daily_stats (user_id, local_date, total_reps, workouts, sets, goal, achieved, updated_at)
  values (p_user, p_date, v_reps, v_count, v_sets, v_goal, v_reps >= v_goal, now())
  on conflict (user_id, local_date) do update set
    total_reps = excluded.total_reps,
    workouts   = excluded.workouts,
    sets       = excluded.sets,
    goal       = excluded.goal,
    achieved   = excluded.achieved,
    updated_at = now();
end;
$$;

create or replace function public.on_workout_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform recompute_daily_stats(old.user_id, old.local_date);
    return old;
  end if;

  perform recompute_daily_stats(new.user_id, new.local_date);

  -- Gdy trening zmienil date, trzeba przeliczyc takze dzien poprzedni.
  if tg_op = 'UPDATE' and old.local_date <> new.local_date then
    perform recompute_daily_stats(old.user_id, old.local_date);
  end if;

  return new;
end;
$$;

drop trigger if exists workouts_stats on public.workouts;
create trigger workouts_stats
  after insert or update or delete on public.workouts
  for each row execute function public.on_workout_change();

create or replace function public.on_set_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workout public.workouts%rowtype;
begin
  select * into v_workout from workouts
  where id = coalesce(new.workout_id, old.workout_id);

  if found then
    perform recompute_daily_stats(v_workout.user_id, v_workout.local_date);
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists workout_sets_stats on public.workout_sets;
create trigger workout_sets_stats
  after insert or update or delete on public.workout_sets
  for each row execute function public.on_set_change();

-- Zmiana celu (dziennego albo domyslnego) tez musi odswiezyc statystyki.
create or replace function public.on_daily_goal_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform recompute_daily_stats(
    coalesce(new.user_id, old.user_id),
    coalesce(new.local_date, old.local_date)
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists daily_goals_stats on public.daily_goals;
create trigger daily_goals_stats
  after insert or update or delete on public.daily_goals
  for each row execute function public.on_daily_goal_change();

-- =============================================================================
-- FUNKCJE POMOCNICZE
-- =============================================================================

-- SECURITY DEFINER omija RLS na tabeli friendships. Bez tego polityki
-- profili i znajomosci odwolywalyby sie wzajemnie i wpadlyby w rekurencje.
create or replace function public.is_friend(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from friendships
    where user_id = auth.uid() and friend_id = p_other
  );
$$;

create or replace function public.generate_friend_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- bez mylacych 0/O, 1/I
  v_code text;
  v_try  int := 0;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;

    exit when not exists (select 1 from profiles where friend_code = v_code);

    v_try := v_try + 1;
    if v_try > 50 then
      raise exception 'Nie udalo sie wygenerowac kodu znajomego';
    end if;
  end loop;

  return v_code;
end;
$$;

-- =============================================================================
-- RPC: rejestracja nazwy uzytkownika
-- =============================================================================

create or replace function public.claim_username(p_username text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Wymagane zalogowanie';
  end if;

  if p_username !~ '^[A-Za-z0-9._]{3,20}$' then
    raise exception 'Niepoprawny format nazwy uzytkownika';
  end if;

  -- Nazwa zajeta przez kogos innego.
  if exists (select 1 from profiles where username = p_username::citext and id <> auth.uid()) then
    return null;
  end if;

  insert into profiles (id, username, friend_code)
  values (auth.uid(), p_username::citext, generate_friend_code())
  on conflict (id) do update set username = excluded.username, updated_at = now()
  returning * into v_profile;

  return v_profile;
end;
$$;

-- =============================================================================
-- RPC: wyszukiwanie znajomych
-- =============================================================================
-- Zwracamy wylacznie id, nazwe i awatar - nigdy calego profilu ani wynikow.

create or replace function public.find_user(p_query text)
returns table (id uuid, username text, avatar_emoji text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username::text, p.avatar_emoji
  from profiles p
  where (p.username = p_query::citext or upper(p.friend_code) = upper(p_query))
    and p.id <> auth.uid()
  limit 1;
$$;

create or replace function public.send_friend_request(p_target uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Wymagane zalogowanie';
  end if;
  if p_target = auth.uid() then
    return 'self';
  end if;
  if exists (select 1 from friendships where user_id = auth.uid() and friend_id = p_target) then
    return 'already_friends';
  end if;

  -- Jesli druga strona juz nas zaprosila, od razu przyjmujemy zaproszenie.
  if exists (
    select 1 from friend_requests
    where from_user = p_target and to_user = auth.uid() and status = 'pending'
  ) then
    update friend_requests set status = 'accepted'
    where from_user = p_target and to_user = auth.uid();

    insert into friendships (user_id, friend_id)
    values (auth.uid(), p_target), (p_target, auth.uid())
    on conflict do nothing;

    return 'accepted';
  end if;

  insert into friend_requests (from_user, to_user, status)
  values (auth.uid(), p_target, 'pending')
  on conflict (from_user, to_user) do update set status = 'pending', created_at = now();

  return 'sent';
end;
$$;

create or replace function public.respond_friend_request(p_request uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.friend_requests;
begin
  select * into v_request from friend_requests where id = p_request;

  if not found or v_request.to_user <> auth.uid() then
    raise exception 'Zaproszenie nie istnieje';
  end if;

  if not p_accept then
    update friend_requests set status = 'declined' where id = p_request;
    return 'declined';
  end if;

  update friend_requests set status = 'accepted' where id = p_request;

  insert into friendships (user_id, friend_id)
  values (v_request.from_user, v_request.to_user), (v_request.to_user, v_request.from_user)
  on conflict do nothing;

  return 'accepted';
end;
$$;

create or replace function public.remove_friend(p_friend uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from friendships
  where (user_id = auth.uid() and friend_id = p_friend)
     or (user_id = p_friend and friend_id = auth.uid());
$$;

-- =============================================================================
-- RPC: ranking znajomych
-- =============================================================================
-- Zakres dat liczy klient w SWOJEJ strefie czasowej i przekazuje go tutaj -
-- dzieki temu "dzis" oznacza dzis u uzytkownika, a nie w strefie serwera.

create or replace function public.friends_leaderboard(p_from date, p_to date)
returns table (user_id uuid, username text, avatar_emoji text, total bigint)
language sql
stable
security definer
set search_path = public
as $$
  with people as (
    select auth.uid() as id
    union
    select friend_id from friendships where user_id = auth.uid()
  )
  select p.id,
         p.username::text,
         p.avatar_emoji,
         coalesce(sum(ds.total_reps), 0)::bigint as total
  from people
  join profiles p on p.id = people.id
  left join daily_stats ds
    on ds.user_id = p.id and ds.local_date between p_from and p_to
  group by p.id, p.username, p.avatar_emoji
  order by total desc, p.username;
$$;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

alter table public.profiles        enable row level security;
alter table public.workouts        enable row level security;
alter table public.workout_sets    enable row level security;
alter table public.daily_goals     enable row level security;
alter table public.daily_stats     enable row level security;
alter table public.friendships     enable row level security;
alter table public.friend_requests enable row level security;

-- PROFILE: widze siebie i znajomych; zmieniam tylko siebie.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_friend(id));

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- TRENINGI: wylacznie wlasciciel, zarowno odczyt jak i zapis.
drop policy if exists workouts_owner on public.workouts;
create policy workouts_owner on public.workouts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists workout_sets_owner on public.workout_sets;
create policy workout_sets_owner on public.workout_sets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists daily_goals_owner on public.daily_goals;
create policy daily_goals_owner on public.daily_goals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- STATYSTYKI DZIENNE: tylko ODCZYT (swoje i znajomych).
-- Brak polityk insert/update/delete oznacza, ze klient nie moze tu nic zapisac -
-- wpisuje je wylacznie trigger dzialajacy jako SECURITY DEFINER.
drop policy if exists daily_stats_read on public.daily_stats;
create policy daily_stats_read on public.daily_stats
  for select using (user_id = auth.uid() or public.is_friend(user_id));

-- ZNAJOMI: widze swoje powiazania, moge je usunac. Dodawanie idzie przez RPC.
drop policy if exists friendships_read on public.friendships;
create policy friendships_read on public.friendships
  for select using (user_id = auth.uid() or friend_id = auth.uid());

drop policy if exists friendships_delete on public.friendships;
create policy friendships_delete on public.friendships
  for delete using (user_id = auth.uid() or friend_id = auth.uid());

-- ZAPROSZENIA: widze wyslane i otrzymane.
drop policy if exists friend_requests_read on public.friend_requests;
create policy friend_requests_read on public.friend_requests
  for select using (from_user = auth.uid() or to_user = auth.uid());

-- =============================================================================
-- UPRAWNIENIA DO FUNKCJI
-- =============================================================================

grant execute on function public.claim_username(text)            to authenticated;
grant execute on function public.find_user(text)                 to authenticated;
grant execute on function public.send_friend_request(uuid)       to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.remove_friend(uuid)             to authenticated;
grant execute on function public.friends_leaderboard(date, date) to authenticated;
grant execute on function public.is_friend(uuid)                 to authenticated;

-- Funkcje wewnetrzne nie sa dostepne dla klienta.
revoke execute on function public.recompute_daily_stats(uuid, date) from public, anon, authenticated;
revoke execute on function public.generate_friend_code()            from public, anon, authenticated;
