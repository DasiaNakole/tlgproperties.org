create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'client' check (role in ('client', 'admin')),
  portal_status text not null default 'pending' check (portal_status in ('pending', 'active', 'suspended')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, role, portal_status)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone',
    coalesce(new.raw_user_meta_data ->> 'role', 'client'),
    case when coalesce(new.raw_user_meta_data ->> 'role', 'client') = 'admin' then 'active' else 'pending' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table if not exists public.portal_milestones (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  details text,
  stage_order integer not null default 1,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'complete')),
  visible_to_client boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.client_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  bucket_path text not null unique,
  original_name text not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.demo_files (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  bucket_path text not null unique,
  description text,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text,
  category text,
  cover_image_url text,
  content text not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  author_id uuid references public.profiles(id) on delete set null,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.portal_milestones enable row level security;
alter table public.client_documents enable row level security;
alter table public.demo_files enable row level security;
alter table public.blog_posts enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create policy "profiles select own or admin"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

create policy "profiles update own or admin"
  on public.profiles for update
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

create policy "admin can manage milestones"
  on public.portal_milestones for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "clients can read own milestones"
  on public.portal_milestones for select
  using (client_id = auth.uid() and visible_to_client = true);

create policy "admin can manage client documents"
  on public.client_documents for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "clients can read own documents"
  on public.client_documents for select
  using (client_id = auth.uid());

create policy "clients can upload own documents"
  on public.client_documents for insert
  with check (client_id = auth.uid() and uploaded_by = auth.uid());

create policy "admin only demo files"
  on public.demo_files for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "public can read published blog posts"
  on public.blog_posts for select
  using (status = 'published' or public.is_admin());

create policy "admin can manage blog posts"
  on public.blog_posts for all
  using (public.is_admin())
  with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('client-documents', 'client-documents', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('demo-files', 'demo-files', false)
on conflict (id) do nothing;

create policy "client document access"
  on storage.objects for select
  using (bucket_id = 'client-documents' and (public.is_admin() or (auth.uid()::text = split_part(name, '/', 1))));

create policy "client document upload"
  on storage.objects for insert
  with check (bucket_id = 'client-documents' and auth.uid()::text = split_part(name, '/', 1));

create policy "admin manage client storage"
  on storage.objects for all
  using (bucket_id = 'client-documents' and public.is_admin())
  with check (bucket_id = 'client-documents' and public.is_admin());

create policy "admin manage demo storage"
  on storage.objects for all
  using (bucket_id = 'demo-files' and public.is_admin())
  with check (bucket_id = 'demo-files' and public.is_admin());
