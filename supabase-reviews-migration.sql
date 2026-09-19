-- Joni Medtech Supply customer ratings & reviews migration
-- Run this file in the Supabase SQL Editor after supabase-schema.sql.
-- This migration is safe to run more than once.

create table if not exists public.reviews (
    id uuid primary key default gen_random_uuid(),
    product_name text not null,
    user_id uuid not null references auth.users(id) on delete cascade,
    customer_name text not null default 'Verified customer',
    rating integer not null check (rating between 1 and 5),
    comment text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (product_name, user_id)
);

create index if not exists reviews_product_name_idx on public.reviews (product_name, created_at desc);

drop trigger if exists reviews_set_updated_at on public.reviews;
create trigger reviews_set_updated_at before update on public.reviews for each row execute function public.set_updated_at();

alter table public.reviews enable row level security;

-- Anyone can read reviews, including signed-out visitors browsing the shop.
drop policy if exists reviews_public_read on public.reviews;
create policy reviews_public_read on public.reviews for select using (true);

-- Signed-in customers can only write, update, or remove their own review.
drop policy if exists reviews_owner_insert on public.reviews;
create policy reviews_owner_insert on public.reviews for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists reviews_owner_update on public.reviews;
create policy reviews_owner_update on public.reviews for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists reviews_owner_delete on public.reviews;
create policy reviews_owner_delete on public.reviews for delete to authenticated using (auth.uid() = user_id);
