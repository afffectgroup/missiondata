-- ============================================================
-- MISSION DATA — Supabase SQL Schema
-- Run this in Supabase → SQL Editor → New query
-- ============================================================

-- 1. PROFILES (extends auth.users)
create table public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  email       text not null,
  full_name   text,
  role        text not null default 'freelance' check (role in ('admin', 'freelance')),
  is_active   boolean not null default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- 2. CAMPAIGNS (dossiers = 1 client miroir + base + séquences)
create table public.campaigns (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references public.profiles(id) on delete cascade not null,
  name            text not null,                    -- nom du dossier
  status          text default 'draft'              -- draft | generating | done
    check (status in ('draft','generating','done')),

  -- Étape 1 : profil client miroir
  client_type     text,                             -- TPE, PME…
  client_sector   text,                             -- Assurance, SaaS…
  client_size     text,                             -- 1-10, 11-50…
  client_location text,                             -- France, Bretagne…
  client_need     text,                             -- site web, rédaction…
  client_budget   text,

  -- Résultats & cas client du freelance
  freelance_result    text,                         -- ce qu'il a accompli
  freelance_kpi       text,                         -- chiffre clé / avant-après
  freelance_angle     text,                         -- angle différenciateur
  freelance_tone      text default 'professionnel', -- ton souhaité

  -- Statistiques
  prospects_count     int default 0,
  sequences_count     int default 0,

  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- 3. PROSPECTS (base de données générée)
create table public.prospects (
  id            uuid default gen_random_uuid() primary key,
  campaign_id   uuid references public.campaigns(id) on delete cascade not null,
  user_id       uuid references public.profiles(id) on delete cascade not null,

  fullname      text,
  job_title     text,
  company       text,
  sector        text,
  email         text,
  email_cert    text,   -- ultra_sure, risky, catch_all…
  linkedin_url  text,
  location      text,
  source        text,   -- icypeas | apify

  created_at    timestamptz default now()
);

-- 4. SEQUENCES (emails + LinkedIn par prospect)
create table public.sequences (
  id            uuid default gen_random_uuid() primary key,
  campaign_id   uuid references public.campaigns(id) on delete cascade not null,
  prospect_id   uuid references public.prospects(id) on delete cascade not null,
  user_id       uuid references public.profiles(id) on delete cascade not null,

  -- 3 emails
  email_1       text,
  email_2       text,
  email_3       text,

  -- 2 messages LinkedIn
  linkedin_1    text,
  linkedin_2    text,

  -- édité par le freelance ?
  edited        boolean default false,

  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles  enable row level security;
alter table public.campaigns enable row level security;
alter table public.prospects enable row level security;
alter table public.sequences enable row level security;

-- Helper function: get current user role
create or replace function public.get_my_role()
returns text language sql security definer stable as $$
  select role from public.profiles where id = auth.uid();
$$;

-- PROFILES policies
create policy "profiles_select_own"   on public.profiles for select using (id = auth.uid() or get_my_role() = 'admin');
create policy "profiles_update_own"   on public.profiles for update using (id = auth.uid() or get_my_role() = 'admin');
create policy "profiles_admin_insert" on public.profiles for insert with check (get_my_role() = 'admin');
create policy "profiles_admin_delete" on public.profiles for delete using (get_my_role() = 'admin');

-- CAMPAIGNS policies (freelance sees only own, admin sees all)
create policy "campaigns_select" on public.campaigns for select using (user_id = auth.uid() or get_my_role() = 'admin');
create policy "campaigns_insert" on public.campaigns for insert with check (user_id = auth.uid());
create policy "campaigns_update" on public.campaigns for update using (user_id = auth.uid() or get_my_role() = 'admin');
create policy "campaigns_delete" on public.campaigns for delete using (user_id = auth.uid() or get_my_role() = 'admin');

-- PROSPECTS policies
create policy "prospects_select" on public.prospects for select using (user_id = auth.uid() or get_my_role() = 'admin');
create policy "prospects_insert" on public.prospects for insert with check (user_id = auth.uid());
create policy "prospects_update" on public.prospects for update using (user_id = auth.uid() or get_my_role() = 'admin');
create policy "prospects_delete" on public.prospects for delete using (user_id = auth.uid() or get_my_role() = 'admin');

-- SEQUENCES policies
create policy "sequences_select" on public.sequences for select using (user_id = auth.uid() or get_my_role() = 'admin');
create policy "sequences_insert" on public.sequences for insert with check (user_id = auth.uid());
create policy "sequences_update" on public.sequences for update using (user_id = auth.uid() or get_my_role() = 'admin');
create policy "sequences_delete" on public.sequences for delete using (user_id = auth.uid() or get_my_role() = 'admin');

-- ============================================================
-- AUTO-UPDATE updated_at
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger campaigns_updated_at before update on public.campaigns for each row execute procedure public.handle_updated_at();
create trigger sequences_updated_at before update on public.sequences for each row execute procedure public.handle_updated_at();

-- ============================================================
-- AUTO-CREATE PROFILE on signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    coalesce(new.raw_user_meta_data->>'role', 'freelance')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- ADMIN VIEW (stats globales)
-- ============================================================
create or replace view public.admin_stats as
select
  (select count(*) from public.profiles where role = 'freelance') as total_freelances,
  (select count(*) from public.profiles where role = 'freelance' and is_active = true) as active_freelances,
  (select count(*) from public.campaigns) as total_campaigns,
  (select count(*) from public.campaigns where status = 'done') as completed_campaigns,
  (select count(*) from public.prospects) as total_prospects,
  (select count(*) from public.sequences) as total_sequences;
