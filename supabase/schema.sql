create extension if not exists "pgcrypto";

create type public.team_role as enum ('owner', 'member', 'viewer');
create type public.list_visibility as enum ('private', 'public_view', 'public_rate');
create type public.rating_source as enum ('team_member', 'external');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.team_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table public.places (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
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
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  visibility public.list_visibility not null default 'public_rate',
  created_at timestamptz not null default now(),
  unique (team_id, slug)
);

create table public.list_places (
  list_id uuid not null references public.lists(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  note text,
  pinned boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (list_id, place_id)
);

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  source public.rating_source not null,
  score numeric(3, 1) not null check (score >= 0 and score <= 5),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (place_id, user_id, source)
);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  url text not null,
  is_cover boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

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

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.places enable row level security;
alter table public.lists enable row level security;
alter table public.list_places enable row level security;
alter table public.ratings enable row level security;
alter table public.photos enable row level security;
alter table public.import_batches enable row level security;

create policy "Public can read public lists" on public.lists
  for select using (visibility in ('public_view', 'public_rate') or public.is_team_member(team_id));

create policy "Members manage lists" on public.lists
  for all using (public.is_team_owner_or_member(team_id))
  with check (public.is_team_owner_or_member(team_id));

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

create policy "Members manage places" on public.places
  for all using (public.is_team_owner_or_member(team_id))
  with check (public.is_team_owner_or_member(team_id));

create policy "Public can read list places for public lists" on public.list_places
  for select using (
    exists (
      select 1
      from public.lists l
      where l.id = list_places.list_id
        and (l.visibility in ('public_view', 'public_rate') or public.is_team_member(l.team_id))
    )
  );

create policy "Members manage list places" on public.list_places
  for all using (
    exists (
      select 1
      from public.lists l
      where l.id = list_places.list_id
        and public.is_team_owner_or_member(l.team_id)
    )
  );

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

create policy "Members can rate team places" on public.ratings
  for insert with check (public.is_team_owner_or_member(team_id));

create policy "External users can rate public-rate lists" on public.ratings
  for insert with check (
    auth.uid() = user_id
    and source = 'external'
    and exists (
      select 1
      from public.list_places lp
      join public.lists l on l.id = lp.list_id
      where lp.place_id = ratings.place_id
        and l.visibility = 'public_rate'
    )
  );

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
