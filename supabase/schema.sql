create extension if not exists "pgcrypto";

do $$
begin
  create type public.team_role as enum ('owner', 'member', 'viewer');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.list_visibility as enum ('private', 'public_view', 'public_rate');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.rating_source as enum ('team_member', 'external');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  display_name text,
  avatar_url text,
  contact_email text,
  contact_phone text,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists contact_email text;
alter table public.profiles add column if not exists contact_phone text;
update public.profiles
set username = 'user' || left(replace(id::text, '-', ''), 12)
where username is null;
update public.profiles
set username = lower(regexp_replace(username, '[^a-z0-9]', '', 'g'))
where username !~ '^[a-z][a-z0-9]{2,31}$'
  and lower(regexp_replace(username, '[^a-z0-9]', '', 'g')) ~ '^[a-z][a-z0-9]{2,31}$';
update public.profiles
set username = 'user' || left(replace(id::text, '-', ''), 12)
where username !~ '^[a-z][a-z0-9]{2,31}$';
update auth.users
set
  email = public.profiles.username || '@users.what-to-eat-today.invalid',
  raw_user_meta_data = coalesce(auth.users.raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('username', public.profiles.username)
from public.profiles
where auth.users.id = public.profiles.id
  and auth.users.email like '%@users.what-to-eat-today.invalid'
  and auth.users.email <> public.profiles.username || '@users.what-to-eat-today.invalid';
alter table public.profiles alter column username set not null;
alter table public.profiles drop column if exists email;

drop index if exists profiles_username_lower_idx;
create unique index profiles_username_lower_idx
  on public.profiles (lower(username));

alter table public.profiles drop constraint if exists profiles_username_format_chk;
alter table public.profiles add constraint profiles_username_format_chk
  check (username ~ '^[a-z][a-z0-9]{2,31}$');

alter table public.profiles drop constraint if exists profiles_contact_email_format_chk;
alter table public.profiles add constraint profiles_contact_email_format_chk
  check (contact_email is null or contact_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');

alter table public.profiles drop constraint if exists profiles_contact_phone_format_chk;
alter table public.profiles add constraint profiles_contact_phone_format_chk
  check (contact_phone is null or contact_phone ~ '^\+?[0-9]{6,20}$');

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  slug text,
  name text not null,
  description text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.team_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  import_key text,
  name text not null,
  category text,
  taste_tags text[] not null default '{}',
  signature_dishes text,
  review_summary text,
  region text,
  location_label text,
  parking_note text,
  source_label text,
  visited boolean not null default false,
  longitude double precision,
  latitude double precision,
  geocode_status text not null default 'pending',
  archived_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, import_key)
);

alter table public.teams add column if not exists slug text;

create unique index if not exists teams_slug_idx
  on public.teams (slug)
  where slug is not null;

create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  visibility public.list_visibility not null default 'public_rate',
  created_at timestamptz not null default now(),
  unique (team_id, slug)
);

create table if not exists public.list_places (
  list_id uuid not null references public.lists(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  note text,
  pinned boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (list_id, place_id)
);

create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  rater_label text,
  source public.rating_source not null,
  score numeric(3, 1) not null check (score >= 0 and score <= 5),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (place_id, user_id, source)
);

alter table public.places add column if not exists import_key text;
alter table public.places add column if not exists archived_at timestamptz;
alter table public.ratings add column if not exists rater_label text;

create unique index if not exists places_team_import_key_idx
  on public.places (team_id, import_key)
  where import_key is not null;

create unique index if not exists ratings_place_source_user_label_idx
  on public.ratings (
    place_id,
    source,
    coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(rater_label, '')
  );

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  url text not null,
  is_cover boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) on delete set null,
  source_name text not null,
  operation text not null default 'seed',
  status text not null default 'completed',
  summary jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  rolled_back_at timestamptz
);

alter table public.import_batches add column if not exists team_id uuid references public.teams(id) on delete set null;
alter table public.import_batches add column if not exists operation text not null default 'seed';
alter table public.import_batches add column if not exists status text not null default 'completed';
alter table public.import_batches add column if not exists summary jsonb not null default '{}'::jsonb;
alter table public.import_batches add column if not exists finished_at timestamptz;
alter table public.import_batches add column if not exists rolled_back_at timestamptz;

alter table public.places add column if not exists import_batch_id uuid references public.import_batches(id);
alter table public.list_places add column if not exists import_batch_id uuid references public.import_batches(id);
alter table public.ratings add column if not exists import_batch_id uuid references public.import_batches(id);

create or replace function public.is_team_member(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members
    where team_id = target_team_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_team_owner_or_member(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members
    where team_id = target_team_id
      and user_id = auth.uid()
      and role in ('owner', 'member')
  );
$$;

create or replace function public.is_team_owner(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members
    where team_id = target_team_id
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate_username text;
begin
  candidate_username := lower(trim(coalesce(new.raw_user_meta_data ->> 'username', '')));

  if candidate_username !~ '^[a-z][a-z0-9]{2,31}$' then
    candidate_username := 'user' || left(replace(new.id::text, '-', ''), 12);
  end if;

  insert into public.profiles (id, username, display_name, avatar_url, contact_email, contact_phone)
  values (
    new.id,
    candidate_username,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    nullif(lower(trim(coalesce(new.raw_user_meta_data ->> 'contact_email', ''))), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'contact_phone', '')), '')
  )
  on conflict (id) do update
  set
    username = coalesce(public.profiles.username, excluded.username),
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    contact_email = coalesce(public.profiles.contact_email, excluded.contact_email),
    contact_phone = coalesce(public.profiles.contact_phone, excluded.contact_phone);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.places enable row level security;
alter table public.lists enable row level security;
alter table public.list_places enable row level security;
alter table public.ratings enable row level security;
alter table public.photos enable row level security;
alter table public.import_batches enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;

drop policy if exists "Users can update own profile" on public.profiles;

drop policy if exists "Public can read teams with public lists" on public.teams;
create policy "Public can read teams with public lists" on public.teams
  for select using (
    public.is_team_member(id)
    or exists (
      select 1
      from public.lists l
      where l.team_id = teams.id
        and l.visibility in ('public_view', 'public_rate')
    )
  );

drop policy if exists "Owners can manage teams" on public.teams;

drop policy if exists "Users can read own team memberships" on public.team_members;
create policy "Users can read own team memberships" on public.team_members
  for select using (user_id = auth.uid() or public.is_team_member(team_id));

drop policy if exists "Owners can manage team memberships" on public.team_members;

drop policy if exists "Public can read public lists" on public.lists;
create policy "Public can read public lists" on public.lists
  for select using (visibility in ('public_view', 'public_rate') or public.is_team_member(team_id));

drop policy if exists "Members manage lists" on public.lists;

drop policy if exists "Public can read places in public lists" on public.places;
create policy "Public can read places in public lists" on public.places
  for select using (
    public.is_team_member(team_id)
    or exists (
      select 1
      from public.list_places lp
      join public.lists l on l.id = lp.list_id
      where lp.place_id = places.id
        and l.visibility in ('public_view', 'public_rate')
    )
  );

drop policy if exists "Members manage places" on public.places;

drop policy if exists "Public can read list places for public lists" on public.list_places;
create policy "Public can read list places for public lists" on public.list_places
  for select using (
    exists (
      select 1
      from public.lists l
      where l.id = list_places.list_id
        and (l.visibility in ('public_view', 'public_rate') or public.is_team_member(l.team_id))
    )
  );

drop policy if exists "Members manage list places" on public.list_places;

drop policy if exists "Public can read ratings for public places" on public.ratings;
create policy "Public can read ratings for public places" on public.ratings
  for select using (
    public.is_team_member(team_id)
    or exists (
      select 1
      from public.list_places lp
      join public.lists l on l.id = lp.list_id
      where lp.place_id = ratings.place_id
        and l.visibility in ('public_view', 'public_rate')
    )
  );

drop policy if exists "Members can rate team places" on public.ratings;

drop policy if exists "Users can update own ratings" on public.ratings;

drop policy if exists "External users can rate public-rate lists" on public.ratings;

drop policy if exists "Public can read public place photos" on public.photos;
create policy "Public can read public place photos" on public.photos
  for select using (
    exists (
      select 1
      from public.places p
      join public.list_places lp on lp.place_id = p.id
      join public.lists l on l.id = lp.list_id
      where p.id = photos.place_id
        and l.visibility in ('public_view', 'public_rate')
    )
  );
