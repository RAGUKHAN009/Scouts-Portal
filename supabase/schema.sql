-- =========================================================================
-- IDBS-ZG Scout Portal — Supabase database schema
-- =========================================================================
-- How to use:
--   1. Create a free project at https://supabase.com
--   2. Open the SQL Editor (left sidebar) -> New query
--   3. Paste this ENTIRE file and click "Run"
--   4. Then follow the storage bucket steps at the bottom of this file
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. PROFILES table (extends Supabase's built-in auth.users with a role)
-- -------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('admin', 'leader')),
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Users can read all profiles"
  on profiles for select
  to authenticated
  using (true);

create policy "Users can update their own profile"
  on profiles for update
  to authenticated
  using (auth.uid() = id);

-- -------------------------------------------------------------------------
-- 2. Reusable column set for the three scout tables
-- -------------------------------------------------------------------------
-- shaheen_scouts  -> under 12  (SS)
-- boy_scouts      -> 12 to 17  (BS)
-- rover_scouts    -> 18+       (RS)

create table if not exists shaheen_scouts (
  id uuid primary key default gen_random_uuid(),
  scout_id text unique not null,
  full_name text not null,
  father_name text not null,
  date_of_birth date not null,
  cnic_or_bform text,
  contact_number text,
  address text,
  blood_group text,
  emergency_contact text,
  photo_url text,
  leader_id uuid references profiles(id),
  status text not null default 'active' check (status in ('active','reverted','promoted','inactive')),
  promotion_due boolean default false,
  promotion_target text,
  revert_mode text,
  revert_reason text,
  reverted_by uuid references profiles(id),
  reverted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists boy_scouts (like shaheen_scouts including all);
create table if not exists rover_scouts (like shaheen_scouts including all);

-- Re-attach primary key / defaults that `like ... including all` does not
-- always carry over cleanly across every Postgres version. Safe to re-run.
alter table boy_scouts alter column id set default gen_random_uuid();
alter table rover_scouts alter column id set default gen_random_uuid();

-- -------------------------------------------------------------------------
-- 3. Sequences + function for generating unique Scout IDs
--    Format: IDBS-ZG-<SS|BS|RS>-<4 digit running number>
-- -------------------------------------------------------------------------
create sequence if not exists ss_id_seq;
create sequence if not exists bs_id_seq;
create sequence if not exists rs_id_seq;

create or replace function generate_scout_id(group_code text)
returns text
language plpgsql
as $$
declare
  next_num integer;
  result text;
begin
  if group_code = 'SS' then
    next_num := nextval('ss_id_seq');
  elsif group_code = 'BS' then
    next_num := nextval('bs_id_seq');
  elsif group_code = 'RS' then
    next_num := nextval('rs_id_seq');
  else
    raise exception 'Unknown group code: %', group_code;
  end if;

  result := 'IDBS-ZG-' || group_code || '-' || lpad(next_num::text, 4, '0');
  return result;
end;
$$;

-- -------------------------------------------------------------------------
-- 4. Activity log (audit trail for reverts / promotions / resubmissions)
-- -------------------------------------------------------------------------
create table if not exists activity_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references profiles(id),
  action text not null,
  target_table text,
  target_id uuid,
  details jsonb,
  created_at timestamptz default now()
);

alter table activity_logs enable row level security;

create policy "Authenticated users can read logs"
  on activity_logs for select
  to authenticated
  using (true);

create policy "Authenticated users can write logs"
  on activity_logs for insert
  to authenticated
  with check (true);

-- -------------------------------------------------------------------------
-- 5. Row Level Security for the 3 scout tables
--    - Leaders: can see/insert their own records, and update only records
--      that belong to them (needed to resubmit a reverted form)
--    - Admins: full access to everything
-- -------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['shaheen_scouts','boy_scouts','rover_scouts']
  loop
    execute format('alter table %I enable row level security', t);

    execute format($f$
      create policy "Admins full access %1$s"
        on %1$I for all
        to authenticated
        using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
        with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
    $f$, t);

    execute format($f$
      create policy "Leaders select own %1$s"
        on %1$I for select
        to authenticated
        using (leader_id = auth.uid());
    $f$, t);

    execute format($f$
      create policy "Leaders insert own %1$s"
        on %1$I for insert
        to authenticated
        with check (leader_id = auth.uid());
    $f$, t);

    execute format($f$
      create policy "Leaders update own %1$s"
        on %1$I for update
        to authenticated
        using (leader_id = auth.uid())
        with check (leader_id = auth.uid());
    $f$, t);
  end loop;
end $$;

-- -------------------------------------------------------------------------
-- 6. Allow any authenticated user to call the ID generator function
-- -------------------------------------------------------------------------
grant execute on function generate_scout_id(text) to authenticated;

-- =========================================================================
-- STORAGE BUCKET (for scout photos taken from the camera)
-- =========================================================================
-- Run this in the same SQL editor. It creates a public-read bucket named
-- "scout-photos" and restricts uploads/updates to logged-in staff only.
-- =========================================================================

insert into storage.buckets (id, name, public)
values ('scout-photos', 'scout-photos', true)
on conflict (id) do nothing;

create policy "Public can view scout photos"
  on storage.objects for select
  to public
  using (bucket_id = 'scout-photos');

create policy "Authenticated can upload scout photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'scout-photos');

create policy "Authenticated can update scout photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'scout-photos');

-- =========================================================================
-- DONE. Next steps (see README.md):
--   1. Create your first admin login under Authentication -> Users
--   2. Insert a matching row into "profiles" with role = 'admin'
--   3. Repeat to create leader accounts with role = 'leader'
-- =========================================================================
