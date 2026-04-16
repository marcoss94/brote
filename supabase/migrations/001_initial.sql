-- Profiles table (extends auth.users)
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  depot_address text,
  depot_lat double precision,
  depot_lng double precision,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Optimization jobs table
create table public.optimization_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  status text not null default 'processing' check (status in ('processing', 'completed', 'error')),
  order_count integer not null default 0,
  original_file_path text,
  result_file_path text,
  config jsonb,
  error_message text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

alter table public.optimization_jobs enable row level security;

create policy "Users can view own jobs"
  on public.optimization_jobs for select
  using (auth.uid() = user_id);

create policy "Users can insert own jobs"
  on public.optimization_jobs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own jobs"
  on public.optimization_jobs for update
  using (auth.uid() = user_id);

-- Geocoding cache table
create table public.geocoding_cache (
  id uuid primary key default gen_random_uuid(),
  address_normalized text unique not null,
  latitude double precision not null,
  longitude double precision not null,
  source text not null default 'nominatim',
  created_at timestamptz default now()
);

alter table public.geocoding_cache enable row level security;

-- Cache is readable by all authenticated users
create policy "Authenticated users can read cache"
  on public.geocoding_cache for select
  to authenticated
  using (true);

create policy "Authenticated users can insert cache"
  on public.geocoding_cache for insert
  to authenticated
  with check (true);

-- Storage buckets
insert into storage.buckets (id, name, public)
values
  ('uploads', 'uploads', false),
  ('results', 'results', false);

-- Storage policies
create policy "Users can upload own files"
  on storage.objects for insert
  to authenticated
  with check (bucket_id in ('uploads', 'results') and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can read own files"
  on storage.objects for select
  to authenticated
  using (bucket_id in ('uploads', 'results') and (storage.foldername(name))[1] = auth.uid()::text);
