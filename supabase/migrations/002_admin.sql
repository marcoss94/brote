-- Admin flag + email on profiles
alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists email text;

-- Backfill existing emails
update public.profiles p
  set email = u.email
  from auth.users u
  where p.id = u.id and p.email is null;

-- Update signup trigger to also store email
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email);
  return new;
end;
$$ language plpgsql security definer;

-- Helper function to check admin without recursing through RLS
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
stable
as $$
  select coalesce((select is_admin from public.profiles where id = uid), false);
$$;

-- Profiles: admins can read all rows
create policy "Admins can view all profiles"
  on public.profiles for select
  to authenticated
  using (public.is_admin(auth.uid()));

-- Optimization jobs: admins can read all rows
create policy "Admins can view all jobs"
  on public.optimization_jobs for select
  to authenticated
  using (public.is_admin(auth.uid()));
