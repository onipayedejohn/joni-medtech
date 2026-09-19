-- Joni Medtech Supply - Supabase schema
-- Run this file in Supabase SQL Editor.
-- This migration is safe to run more than once.

create extension if not exists pgcrypto;

create table if not exists public.products (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    slug text not null unique,
    description text not null default '',
    image_path text not null default '',
    price numeric(12, 2) not null check (price >= 0),
    stock integer not null default 0 check (stock >= 0),
    category text not null default 'Other',
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
    key text primary key,
    value jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
);

create table if not exists public.orders (
    id uuid primary key default gen_random_uuid(),
    order_number text not null unique default ('JONI-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
    customer_name text not null,
    customer_email text not null,
    customer_phone text not null,
    delivery_location text not null,
    notes text not null default '',
    status text not null default 'pending' check (status in ('pending', 'confirmed', 'processing', 'completed', 'cancelled')),
    subtotal numeric(12, 2) not null default 0 check (subtotal >= 0),
    delivery_fee numeric(12, 2) not null default 0 check (delivery_fee >= 0),
    total numeric(12, 2) not null default 0 check (total >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references public.orders(id) on delete cascade,
    product_id uuid references public.products(id) on delete set null,
    product_name text not null,
    unit_price numeric(12, 2) not null check (unit_price >= 0),
    quantity integer not null check (quantity > 0),
    line_total numeric(12, 2) generated always as (unit_price * quantity) stored,
    created_at timestamptz not null default now()
);

create table if not exists public.wishlists (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    product_id uuid not null references public.products(id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (user_id, product_id)
);

create table if not exists public.carts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    product_id uuid not null references public.products(id) on delete cascade,
    quantity integer not null default 1 check (quantity > 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, product_id)
);

create index if not exists products_active_idx on public.products (is_active, created_at desc);
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists order_items_product_id_idx on public.order_items (product_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();
drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders for each row execute function public.set_updated_at();
drop trigger if exists carts_set_updated_at on public.carts;
create trigger carts_set_updated_at before update on public.carts for each row execute function public.set_updated_at();
drop trigger if exists site_settings_set_updated_at on public.site_settings;
create trigger site_settings_set_updated_at before update on public.site_settings for each row execute function public.set_updated_at();

alter table public.products enable row level security;
alter table public.site_settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.wishlists enable row level security;
alter table public.carts enable row level security;

-- Public storefront reads only active products and public settings.
drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products for select using (is_active = true);
drop policy if exists settings_public_read on public.site_settings;
create policy settings_public_read on public.site_settings for select using (key in ('storefront', 'homepage'));

-- Customers can only manage their own authenticated cart and wishlist.
drop policy if exists wishlist_owner_all on public.wishlists;
create policy wishlist_owner_all on public.wishlists for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists cart_owner_all on public.carts;
create policy cart_owner_all on public.carts for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Orders are private by default. Use the server-side service role for admin reads/updates.
drop policy if exists orders_authenticated_insert on public.orders;
create policy orders_authenticated_insert on public.orders for insert to authenticated with check (auth.uid() is not null);
drop policy if exists order_items_authenticated_insert on public.order_items;
create policy order_items_authenticated_insert on public.order_items for insert to authenticated with check (auth.uid() is not null);

-- Create orders through a controlled RPC rather than exposing unrestricted table inserts.
create or replace function public.create_order(
    p_customer_name text,
    p_customer_email text,
    p_customer_phone text,
    p_delivery_location text,
    p_notes text,
    p_items jsonb
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
    created_order public.orders;
    item jsonb;
    resolved_product public.products;
    computed_subtotal numeric(12, 2) := 0;
    item_quantity integer;
    item_price numeric(12, 2);
begin
    if coalesce(trim(p_customer_name), '') = '' or coalesce(trim(p_customer_email), '') = '' or coalesce(trim(p_customer_phone), '') = '' or coalesce(trim(p_delivery_location), '') = '' then
        raise exception 'Customer details are required';
    end if;
    if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
        raise exception 'At least one order item is required';
    end if;

    for item in select * from jsonb_array_elements(p_items)
    loop
        select * into resolved_product from public.products where id = (item->>'product_id')::uuid and is_active = true for update;
        if not found then raise exception 'Product is unavailable'; end if;
        item_quantity := greatest(1, (item->>'quantity')::integer);
        if resolved_product.stock < item_quantity then raise exception 'Insufficient stock for %', resolved_product.name; end if;
        item_price := resolved_product.price;
        computed_subtotal := computed_subtotal + (item_price * item_quantity);
    end loop;

    insert into public.orders (customer_name, customer_email, customer_phone, delivery_location, notes, subtotal, total)
    values (trim(p_customer_name), lower(trim(p_customer_email)), trim(p_customer_phone), trim(p_delivery_location), coalesce(p_notes, ''), computed_subtotal, computed_subtotal)
    returning * into created_order;

    for item in select * from jsonb_array_elements(p_items)
    loop
        select * into resolved_product from public.products where id = (item->>'product_id')::uuid;
        item_quantity := greatest(1, (item->>'quantity')::integer);
        insert into public.order_items (order_id, product_id, product_name, unit_price, quantity)
        values (created_order.id, resolved_product.id, resolved_product.name, resolved_product.price, item_quantity);
        update public.products set stock = stock - item_quantity where id = resolved_product.id;
    end loop;

    return created_order;
end;
$$;

revoke all on function public.create_order(text, text, text, text, text, jsonb) from public;
grant execute on function public.create_order(text, text, text, text, text, jsonb) to anon, authenticated;

insert into public.site_settings (key, value)
values
    ('storefront', '{"business_name":"Joni Medtech Supply","phone":"+233 24 969 8992","email":"onipayedejohn11@gmail.com","location":"Obuasi, Ashanti Region, Ghana"}'::jsonb),
    ('homepage', '{"announcement":"Professional laboratory solutions for healthcare and research."}'::jsonb)
on conflict (key) do nothing;

-- Storage bucket for product images.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = excluded.public;

 drop policy if exists product_images_public_read on storage.objects;
create policy product_images_public_read on storage.objects for select using (bucket_id = 'product-images');
drop policy if exists product_images_authenticated_upload on storage.objects;
create policy product_images_authenticated_upload on storage.objects for insert to authenticated with check (bucket_id = 'product-images');
drop policy if exists product_images_authenticated_update on storage.objects;
create policy product_images_authenticated_update on storage.objects for update to authenticated using (bucket_id = 'product-images') with check (bucket_id = 'product-images');
drop policy if exists product_images_authenticated_delete on storage.objects;
create policy product_images_authenticated_delete on storage.objects for delete to authenticated using (bucket_id = 'product-images');

-- Optional seed examples. Replace these with your final catalogue or import them via the admin API.
-- insert into public.products (name, slug, description, image_path, price, stock, category)
-- values ('Example Product', 'example-product', 'Example description', 'example.jfif', 10.00, 10, 'Other');
