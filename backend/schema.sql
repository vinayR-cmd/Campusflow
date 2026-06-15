-- CampusFlow Phase 1 schema
-- Run this entire file once in the Supabase SQL editor (Project -> SQL Editor -> New query).

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists profiles (
  student_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  college text,
  college_domain text,
  branch text,
  year int,
  section text,
  hostel text,
  goal text,
  target_companies text[] default '{}',
  skills text[] default '{}',
  timetable_uploaded boolean default false,
  gmail_access_token text,
  gmail_refresh_token text,
  gmail_connected boolean default false,
  profile_complete boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists digital_twin (
  student_id uuid primary key references auth.users(id) on delete cascade,
  ahs_score numeric default 0,
  data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists timetable_slots (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  day text not null,
  time_start text not null,
  time_end text not null,
  subject text not null,
  room text,
  faculty text,
  created_at timestamptz default now()
);

create table if not exists campus_docs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  college text not null,
  doc_type text not null,
  branch text default 'All',
  year text default 'All',
  section text default 'All',
  hostel_wing text default 'All',
  file_path text not null,
  chunks_count int default 0,
  upload_date timestamptz default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  task text not null,
  subject text,
  deadline timestamptz,
  priority text default 'medium',
  type text default 'notice',
  status text default 'pending',
  source text default 'gmail',
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY (every row is scoped to student_id = auth.uid())
-- ============================================================

alter table profiles enable row level security;
alter table digital_twin enable row level security;
alter table timetable_slots enable row level security;
alter table campus_docs enable row level security;
alter table tasks enable row level security;

create policy "profiles_owner_select" on profiles for select using (student_id = auth.uid());
create policy "profiles_owner_insert" on profiles for insert with check (student_id = auth.uid());
create policy "profiles_owner_update" on profiles for update using (student_id = auth.uid());

create policy "digital_twin_owner_select" on digital_twin for select using (student_id = auth.uid());
create policy "digital_twin_owner_insert" on digital_twin for insert with check (student_id = auth.uid());
create policy "digital_twin_owner_update" on digital_twin for update using (student_id = auth.uid());

create policy "timetable_slots_owner_select" on timetable_slots for select using (student_id = auth.uid());
create policy "timetable_slots_owner_insert" on timetable_slots for insert with check (student_id = auth.uid());
create policy "timetable_slots_owner_update" on timetable_slots for update using (student_id = auth.uid());
create policy "timetable_slots_owner_delete" on timetable_slots for delete using (student_id = auth.uid());

create policy "campus_docs_owner_select" on campus_docs for select using (student_id = auth.uid());
create policy "campus_docs_owner_insert" on campus_docs for insert with check (student_id = auth.uid());

create policy "tasks_owner_select" on tasks for select using (student_id = auth.uid());
create policy "tasks_owner_insert" on tasks for insert with check (student_id = auth.uid());
create policy "tasks_owner_update" on tasks for update using (student_id = auth.uid());
create policy "tasks_owner_delete" on tasks for delete using (student_id = auth.uid());

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================

insert into storage.buckets (id, name, public)
values ('timetables', 'timetables', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('campus-docs', 'campus-docs', false)
on conflict (id) do nothing;

-- Students can only read/write files under a path that starts with their own user id,
-- e.g. timetables/{student_id}/timetable.pdf
create policy "timetables_owner_all" on storage.objects for all
  using (bucket_id = 'timetables' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'timetables' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "campus_docs_owner_all" on storage.objects for all
  using (bucket_id = 'campus-docs' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'campus-docs' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- PHASE 2 EXTENSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS club_events (
  id uuid primary key default gen_random_uuid(),
  college text,
  club_name text,
  event_name text,
  event_date date,
  venue text,
  description text,
  registration_deadline date,
  eligibility text,
  category text default 'general',
  open_to text default 'all',
  uploaded_by uuid references profiles(student_id),
  created_at timestamptz default now()
);
ALTER TABLE club_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clubs_read_all" ON club_events FOR SELECT USING (true);
CREATE POLICY "clubs_insert_auth" ON club_events FOR INSERT WITH CHECK (auth.uid() = uploaded_by);

CREATE TABLE IF NOT EXISTS weekly_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references profiles(student_id),
  week_start date,
  plan jsonb,
  approved bool default false,
  created_at timestamptz default now(),
  UNIQUE(student_id, week_start)
);
ALTER TABLE weekly_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans_owner" ON weekly_plans FOR ALL USING (auth.uid() = student_id);

ALTER TABLE mood_logs ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bus_route text;
ALTER TABLE digital_twin ADD COLUMN IF NOT EXISTS wellness_flag bool default false;
ALTER TABLE digital_twin ADD COLUMN IF NOT EXISTS exam_week bool default false;

