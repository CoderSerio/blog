begin;

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'editor', 'user')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_user_roles_updated_at on public.user_roles;
create trigger touch_user_roles_updated_at
before update on public.user_roles
for each row execute function public.touch_updated_at();

drop policy if exists "Users can read their own role" on public.user_roles;
create policy "Users can read their own role"
on public.user_roles
for select
to authenticated
using (auth.uid() = user_id);

create or replace function public.is_owner(check_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = check_user_id
      and role = 'owner'
  );
$$;

drop policy if exists "Owners can read all roles" on public.user_roles;
create policy "Owners can read all roles"
on public.user_roles
for select
to authenticated
using (public.is_owner(auth.uid()));

drop policy if exists "Owners can create roles" on public.user_roles;
create policy "Owners can create roles"
on public.user_roles
for insert
to authenticated
with check (public.is_owner(auth.uid()));

drop policy if exists "Owners can update roles" on public.user_roles;
create policy "Owners can update roles"
on public.user_roles
for update
to authenticated
using (public.is_owner(auth.uid()))
with check (public.is_owner(auth.uid()));

drop policy if exists "Owners can delete roles" on public.user_roles;
create policy "Owners can delete roles"
on public.user_roles
for delete
to authenticated
using (public.is_owner(auth.uid()));

insert into public.user_roles (user_id, role)
values ('11ecc369-dedf-493e-abee-043514f99d19', 'owner')
on conflict (user_id) do update set role = excluded.role;

commit;

select user_id, role, created_at, updated_at from public.user_roles order by created_at;
