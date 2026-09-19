-- ============================================================================
--  Repsy - hartowanie bazy pod wersje webowa
-- ============================================================================
--
--  W aplikacji mobilnej kod jest w paczce; w aplikacji webowej cale zrodlo
--  JavaScript jest jawne i kazdy moze wolac API recznie. Zalozenie tej
--  migracji: KLIENT NIE JEST ZAUFANY. Wszystko, co dotad opieralo sie na
--  szczesliwym zbiegu okolicznosci, zostaje zapisane wprost.
--
--  Migracja jest idempotentna - mozna ja uruchomic ponownie bez szkody.
--
--  Cztery rzeczy:
--
--  1. UPRAWNIENIA WYKONYWANIA FUNKCJI
--     PostgreSQL przy CREATE FUNCTION nadaje EXECUTE roli PUBLIC. Rola `anon`
--     (klucz publiczny, ktory siedzi w kodzie strony) nalezy do PUBLIC, wiec
--     samo "grant execute to authenticated" NICZEGO nie ograniczalo - anon
--     i tak mogl wolac te funkcje. Tutaj jawnie odbieramy PUBLIC i anon.
--
--  2. STRAZNICY ZALOGOWANIA
--     find_user, respond_friend_request, remove_friend i friends_leaderboard
--     nie sprawdzaly, czy ktos jest zalogowany. W praktyce nie zwracaly nic,
--     bo porownanie z NULL (auth.uid() dla niezalogowanego) nie pasuje do
--     zadnego wiersza - ale to przypadek, a nie zabezpieczenie. Jedna zmiana
--     w zapytaniu i przestaloby dzialac. Teraz warunek jest jawny.
--
--  3. KOD ZNAJOMEGO Z GENERATORA KRYPTOGRAFICZNEGO
--     random() w PostgreSQL to zwykly generator pseudolosowy o przewidywalnym
--     stanie. Dla kodu, ktory sluzy za zaproszenie, uzywamy gen_random_bytes().
--
--  4. OGRANICZENIE CZESTOTLIWOSCI (rate limiting)
--     Kod znajomego ma 6 znakow z 32-znakowego alfabetu (~1,07 mld kombinacji).
--     Bez ograniczen mozna go zgadywac w nieskonczonosc. Limit sprawia, ze
--     zgadywanie przestaje byc praktyczne, a backend nie da sie zasypac.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 4a. Licznik zuzycia - tabela wylacznie dla funkcji security definer.
-- ---------------------------------------------------------------------------
create table if not exists public.rate_limits (
  user_id      uuid        not null references auth.users(id) on delete cascade,
  action       text        not null,
  window_start timestamptz not null default now(),
  hits         int         not null default 0,
  primary key (user_id, action)
);

alter table public.rate_limits enable row level security;

-- Swiadomie BEZ ZADNEJ POLITYKI: przy wlaczonym RLS i braku polityk zwykly
-- klient nie odczyta ani nie zmieni tu niczego. Dostep maja tylko funkcje
-- security definer ponizej. Gdyby uzytkownik mogl kasowac swoje wiersze,
-- omijalby limit jednym zapytaniem.

-- ---------------------------------------------------------------------------
-- 4b. Wspolny straznik limitu.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_rate_limit(
  p_action text,
  p_max    int,
  p_window interval
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now  timestamptz := now();
  v_hits int;
begin
  if auth.uid() is null then
    raise exception 'Wymagane zalogowanie' using errcode = '28000';
  end if;

  insert into rate_limits as rl (user_id, action, window_start, hits)
  values (auth.uid(), p_action, v_now, 1)
  on conflict (user_id, action) do update
    set hits = case
                 when rl.window_start < v_now - p_window then 1
                 else rl.hits + 1
               end,
        window_start = case
                 when rl.window_start < v_now - p_window then v_now
                 else rl.window_start
               end
  returning rl.hits into v_hits;

  if v_hits > p_max then
    -- Komunikat celowo ogolny: nie zdradzamy limitu ani dlugosci okna.
    raise exception 'Za duzo prob, odczekaj chwile' using errcode = '53400';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Kod znajomego z generatora kryptograficznego.
-- ---------------------------------------------------------------------------
create or replace function public.generate_friend_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- bez mylacych 0/O, 1/I
  v_code  text;
  v_bytes bytea;
  v_try   int := 0;
begin
  loop
    v_code  := '';
    v_bytes := gen_random_bytes(6);

    for i in 1..6 loop
      -- 32-znakowy alfabet = dokladnie 5 bitow na znak, wiec maska 31 nie
      -- wprowadza przechylenia rozkladu (256 nie dzieli sie przez 32 bez
      -- reszty, ale 32 jest potega dwojki - dolne 5 bitow jest rowne).
      v_code := v_code || substr(v_alphabet, 1 + (get_byte(v_bytes, i - 1) & 31), 1);
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

-- ---------------------------------------------------------------------------
-- 2. + 4c. Straznicy zalogowania i limity w funkcjach uzytkownika.
-- ---------------------------------------------------------------------------

-- find_user bylo `language sql`; przechodzi na plpgsql, zeby moc wywolac limit.
-- Zwracany zestaw kolumn pozostaje ten sam - minimum do pokazania "dodac?".
create or replace function public.find_user(p_query text)
returns table (id uuid, username text, avatar_emoji text)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if auth.uid() is null then
    raise exception 'Wymagane zalogowanie' using errcode = '28000';
  end if;

  -- Najwazniejszy limit w calej aplikacji: to jedyne miejsce, w ktorym da sie
  -- zgadywac cudze kody znajomych.
  perform enforce_rate_limit('find_user', 20, interval '1 minute');

  return query
    select p.id, p.username::text, p.avatar_emoji
    from profiles p
    where (p.username = p_query::citext or upper(p.friend_code) = upper(p_query))
      and p.id <> auth.uid()
    limit 1;
end;
$$;

-- Zaproszenia: ograniczamy zasypywanie innych uzytkownikow.
create or replace function public.send_friend_request(p_target uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Wymagane zalogowanie' using errcode = '28000';
  end if;

  perform enforce_rate_limit('send_friend_request', 10, interval '1 hour');

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

-- Wybor nazwy uzytkownika: ograniczamy zgadywanie, ktore nazwy sa zajete.
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
    raise exception 'Wymagane zalogowanie' using errcode = '28000';
  end if;

  perform enforce_rate_limit('claim_username', 15, interval '10 minutes');

  if p_username !~ '^[A-Za-z0-9._]{3,20}$' then
    raise exception 'Niepoprawny format nazwy uzytkownika';
  end if;

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

-- Odpowiedz na zaproszenie.
-- ZMIANA WYLACZNIE BEZPIECZENSTWA: dochodzi jawny straznik zalogowania.
-- Reszta - lacznie ze zwracanym napisem i zglaszaniem wyjatku dla cudzego
-- lub nieistniejacego zaproszenia - zostaje dokladnie jak byla. Jeden
-- wspolny komunikat dla obu tych przypadkow jest celowy: nie zdradza,
-- czy zaproszenie o danym identyfikatorze w ogole istnieje.
create or replace function public.respond_friend_request(p_request uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.friend_requests;
begin
  if auth.uid() is null then
    raise exception 'Wymagane zalogowanie' using errcode = '28000';
  end if;

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

-- Usuniecie znajomego.
-- ZMIANA WYLACZNIE BEZPIECZENSTWA: jawny straznik zalogowania. Zapytanie
-- kasujace zostaje identyczne (usuwa obie strony symetrycznej znajomosci).
create or replace function public.remove_friend(p_friend uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Wymagane zalogowanie' using errcode = '28000';
  end if;

  delete from friendships
  where (user_id = auth.uid() and friend_id = p_friend)
     or (user_id = p_friend and friend_id = auth.uid());
end;
$$;
-- Ranking: jawny straznik zalogowania. Zwracamy wylacznie to, co ranking
-- musi pokazac - nazwe, emoji i sume powtorzen. Zadnych celow, historii
-- ani dat treningow innych osob.
create or replace function public.friends_leaderboard(p_from date, p_to date)
returns table (user_id uuid, username text, avatar_emoji text, total bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if auth.uid() is null then
    raise exception 'Wymagane zalogowanie' using errcode = '28000';
  end if;

  -- Zakres dat pochodzi od klienta, wiec go ograniczamy. Bez tego ktos moglby
  -- poprosic o sume z 200 lat i niepotrzebnie obciazyc baze.
  if p_from > p_to or p_to - p_from > 400 then
    raise exception 'Niepoprawny zakres dat';
  end if;

  return query
    with people as (
      select auth.uid() as id
      union
      select f.friend_id from friendships f where f.user_id = auth.uid()
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
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Uprawnienia: najpierw odbierz PUBLIC i anon, dopiero potem nadaj.
-- ---------------------------------------------------------------------------
revoke execute on function public.claim_username(text)                  from public, anon;
revoke execute on function public.find_user(text)                       from public, anon;
revoke execute on function public.send_friend_request(uuid)             from public, anon;
revoke execute on function public.respond_friend_request(uuid, boolean) from public, anon;
revoke execute on function public.remove_friend(uuid)                   from public, anon;
revoke execute on function public.friends_leaderboard(date, date)       from public, anon;
revoke execute on function public.is_friend(uuid)                       from public, anon;

-- Funkcje czysto wewnetrzne: nie wola ich nikt z zewnatrz.
revoke execute on function public.enforce_rate_limit(text, int, interval) from public, anon, authenticated;
revoke execute on function public.generate_friend_code()                 from public, anon, authenticated;
revoke execute on function public.recompute_daily_stats(uuid, date)      from public, anon, authenticated;

grant execute on function public.claim_username(text)                  to authenticated;
grant execute on function public.find_user(text)                       to authenticated;
grant execute on function public.send_friend_request(uuid)             to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.remove_friend(uuid)                   to authenticated;
grant execute on function public.friends_leaderboard(date, date)       to authenticated;
grant execute on function public.is_friend(uuid)                       to authenticated;

-- Tabela licznikow nie jest dostepna dla nikogo poza funkcjami powyzej.
revoke all on table public.rate_limits from public, anon, authenticated;
