-- ============================================================
-- MISSION FREELANCES — Supabase SQL Schema v3.0
-- Run in Supabase → SQL Editor → New query
-- ============================================================

-- 1. PROFILES (extends auth.users)
create table if not exists public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  email       text not null,
  full_name   text,
  role        text not null default 'freelance'
              check (role in ('admin', 'freelance')),
  is_active   boolean not null default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- 2. CAMPAIGNS
create table if not exists public.campaigns (
  id               uuid default gen_random_uuid() primary key,
  user_id          uuid references public.profiles(id) on delete cascade not null,
  name             text not null,
  status           text default 'draft'
                   check (status in ('draft','generating','done')),
  -- Client miroir
  client_type      text,
  client_sector    text,
  client_size      text,
  client_location  text,
  client_need      text,
  client_budget    text,
  -- Freelance value prop
  freelance_result text,
  freelance_kpi    text,
  freelance_angle  text,
  freelance_tone   text default 'Professionnel',
  -- Stats
  prospects_count  int default 0,
  sequences_count  int default 0,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- 3. PROSPECTS
create table if not exists public.prospects (
  id           uuid default gen_random_uuid() primary key,
  campaign_id  uuid references public.campaigns(id) on delete cascade not null,
  user_id      uuid references public.profiles(id) on delete cascade not null,
  fullname     text,
  job_title    text,
  company      text,
  sector       text,
  email        text,
  email_cert   text,  -- ultra_sure | sure | probable | risky
  linkedin_url text,
  location     text,
  source       text default 'icypeas',
  created_at   timestamptz default now()
);

-- 4. SEQUENCES
create table if not exists public.sequences (
  id           uuid default gen_random_uuid() primary key,
  campaign_id  uuid references public.campaigns(id) on delete cascade not null,
  prospect_id  uuid references public.prospects(id) on delete cascade not null,
  user_id      uuid references public.profiles(id) on delete cascade not null,
  -- Emails
  email_1      text,
  email_2      text,
  email_3      text,
  -- LinkedIn
  linkedin_1   text,
  linkedin_2   text,
  -- Meta
  edited       boolean default false,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  -- Upsert constraint (one sequence per prospect per campaign)
  unique (campaign_id, prospect_id)
);

-- ============================================================
-- TRIGGERS — updated_at auto-update
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'campaigns_updated_at') then
    create trigger campaigns_updated_at before update on public.campaigns
      for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'sequences_updated_at') then
    create trigger sequences_updated_at before update on public.sequences
      for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'profiles_updated_at') then
    create trigger profiles_updated_at before update on public.profiles
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- ============================================================
-- TRIGGER — auto-create profile on signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'freelance'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles  enable row level security;
alter table public.campaigns enable row level security;
alter table public.prospects enable row level security;
alter table public.sequences enable row level security;

-- Helper: get current user role
create or replace function public.get_my_role()
returns text language sql security definer stable as $$
  select role from public.profiles where id = auth.uid();
$$;

-- PROFILES
create policy "profiles_select" on public.profiles for select
  using (id = auth.uid() or get_my_role() = 'admin');
create policy "profiles_update" on public.profiles for update
  using (id = auth.uid() or get_my_role() = 'admin');

-- CAMPAIGNS
create policy "campaigns_select" on public.campaigns for select
  using (user_id = auth.uid() or get_my_role() = 'admin');
create policy "campaigns_insert" on public.campaigns for insert
  with check (user_id = auth.uid());
create policy "campaigns_update" on public.campaigns for update
  using (user_id = auth.uid() or get_my_role() = 'admin');
create policy "campaigns_delete" on public.campaigns for delete
  using (user_id = auth.uid() or get_my_role() = 'admin');

-- PROSPECTS
create policy "prospects_select" on public.prospects for select
  using (user_id = auth.uid() or get_my_role() = 'admin');
create policy "prospects_insert" on public.prospects for insert
  with check (user_id = auth.uid());
create policy "prospects_delete" on public.prospects for delete
  using (user_id = auth.uid() or get_my_role() = 'admin');

-- SEQUENCES
create policy "sequences_select" on public.sequences for select
  using (user_id = auth.uid() or get_my_role() = 'admin');
create policy "sequences_insert" on public.sequences for insert
  with check (user_id = auth.uid());
create policy "sequences_update" on public.sequences for update
  using (user_id = auth.uid() or get_my_role() = 'admin');
create policy "sequences_delete" on public.sequences for delete
  using (user_id = auth.uid() or get_my_role() = 'admin');

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_campaigns_user on public.campaigns(user_id);
create index if not exists idx_prospects_campaign on public.prospects(campaign_id);
create index if not exists idx_prospects_user on public.prospects(user_id);
create index if not exists idx_sequences_campaign on public.sequences(campaign_id);
create index if not exists idx_sequences_prospect on public.sequences(prospect_id);
