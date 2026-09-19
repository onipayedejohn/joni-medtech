-- Joni Medtech Supply authentication and RBAC migration
-- REVIEW ONLY: run manually in Supabase SQL Editor after reviewing.
-- No existing tables or rows are dropped. Existing orders remain valid with user_id NULL.
-- Rollback guidance is at the end of this file.

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text not null default '',
    role text not null default 'customer' check (role in ('customer', 'staff', 'admin')),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.orders add column if not exists user_id uuid references auth.users(id) on delete set null;
create index if not exists orders_user_id_idx on public.orders (user_id, created_at desc);

create or replace function public.set_profile_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_profile_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, full_name, role)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), 'customer')
    on conflict (id) do update set full_name = case when public.profiles.full_name = '' then excluded.full_name else public.profiles.full_name end;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Trigger-only function: never meant to be called directly via PostgREST RPC.
-- Supabase grants EXECUTE to anon/authenticated directly (not only via PUBLIC) on
-- function creation, so "revoke ... from public" alone does not remove those grants.
revoke all on function public.handle_new_user() from public, anon, authenticated;

insert into public.profiles (id, full_name)
select id, coalesce(raw_user_meta_data ->> 'full_name', '') from auth.users
on conflict (id) do nothing;

create or replace function public.has_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.profiles
        where id = auth.uid() and is_active = true and (
            role = required_role or (required_role = 'staff' and role = 'admin')
        )
    );
$$;

revoke all on function public.has_role(text) from public, anon, authenticated;
grant execute on function public.has_role(text) to authenticated;

alter table public.profiles enable row level security;
drop policy if exists profiles_owner_read on public.profiles;
create policy profiles_owner_read on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists profiles_owner_update_safe on public.profiles;
create policy profiles_owner_update_safe on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists profiles_staff_read on public.profiles;
create policy profiles_staff_read on public.profiles for select to authenticated using (public.has_role('staff'));

-- Prevent clients from changing role or activation state through profile updates.
create or replace function public.prevent_profile_privilege_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    if new.role is distinct from old.role or new.is_active is distinct from old.is_active then
        -- SQL Editor/service-role migrations have no end-user auth.uid().
        -- Authenticated browser users must already be active administrators.
        if auth.uid() is not null and not public.has_role('admin') then
            raise exception 'Only an administrator can change profile privileges';
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists profiles_prevent_privilege_change on public.profiles;
create trigger profiles_prevent_privilege_change before update on public.profiles for each row execute function public.prevent_profile_privilege_change();

-- Trigger-only function: never meant to be called directly via PostgREST RPC.
revoke all on function public.prevent_profile_privilege_change() from public, anon, authenticated;

-- Products and settings are writable only by staff/admin; public reads remain available.
drop policy if exists products_staff_write on public.products;
create policy products_staff_write on public.products for all to authenticated using (public.has_role('staff')) with check (public.has_role('staff'));
drop policy if exists settings_staff_write on public.site_settings;
create policy settings_staff_write on public.site_settings for all to authenticated using (public.has_role('staff')) with check (public.has_role('staff'));

-- Customers can read their own orders. Staff/admin can manage all orders.
drop policy if exists orders_owner_read on public.orders;
create policy orders_owner_read on public.orders for select to authenticated using (user_id = auth.uid());
drop policy if exists orders_staff_all on public.orders;
create policy orders_staff_all on public.orders for all to authenticated using (public.has_role('staff')) with check (public.has_role('staff'));
drop policy if exists order_items_owner_read on public.order_items;
create policy order_items_owner_read on public.order_items for select to authenticated using (exists (select 1 from public.orders where orders.id = order_items.order_id and orders.user_id = auth.uid()));
drop policy if exists order_items_staff_all on public.order_items;
create policy order_items_staff_all on public.order_items for all to authenticated using (public.has_role('staff')) with check (public.has_role('staff'));

-- Replace the earlier RPC with an authenticated, profile-linked order flow.
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
begin
    if auth.uid() is null then raise exception 'Authentication is required'; end if;
    if not exists (select 1 from public.profiles where id = auth.uid() and is_active = true) then raise exception 'Active profile is required'; end if;
    if coalesce(trim(p_customer_name), '') = '' or coalesce(trim(p_customer_email), '') = '' or coalesce(trim(p_customer_phone), '') = '' or coalesce(trim(p_delivery_location), '') = '' then raise exception 'Customer details are required'; end if;
    if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'At least one order item is required'; end if;

    for item in select * from jsonb_array_elements(p_items)
    loop
        select * into resolved_product from public.products where id = (item->>'product_id')::uuid and is_active = true for update;
        if not found then raise exception 'Product is unavailable'; end if;
        item_quantity := greatest(1, (item->>'quantity')::integer);
        if resolved_product.stock < item_quantity then raise exception 'Insufficient stock for %', resolved_product.name; end if;
        computed_subtotal := computed_subtotal + (resolved_product.price * item_quantity);
    end loop;

    insert into public.orders (user_id, customer_name, customer_email, customer_phone, delivery_location, notes, subtotal, total)
    values (auth.uid(), trim(p_customer_name), lower(trim(p_customer_email)), trim(p_customer_phone), trim(p_delivery_location), coalesce(p_notes, ''), computed_subtotal, computed_subtotal)
    returning * into created_order;

    for item in select * from jsonb_array_elements(p_items)
    loop
        select * into resolved_product from public.products where id = (item->>'product_id')::uuid;
        item_quantity := greatest(1, (item->>'quantity')::integer);
        insert into public.order_items (order_id, product_id, product_name, unit_price, quantity) values (created_order.id, resolved_product.id, resolved_product.name, resolved_product.price, item_quantity);
        update public.products set stock = stock - item_quantity where id = resolved_product.id;
    end loop;
    return created_order;
end;
$$;

revoke execute on function public.create_order(text, text, text, text, text, jsonb) from anon;
grant execute on function public.create_order(text, text, text, text, text, jsonb) to authenticated;

-- Authenticated customers can look up only their own order status.
create or replace function public.lookup_order_status(p_order_number text, p_customer_email text)
returns table (
    id uuid,
    order_number text,
    status text,
    total numeric,
    delivery_location text,
    created_at timestamptz,
    order_items jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
    select o.id, o.order_number, o.status, o.total, o.delivery_location, o.created_at,
        coalesce(jsonb_agg(jsonb_build_object('product_name', oi.product_name, 'quantity', oi.quantity, 'line_total', oi.line_total)) filter (where oi.id is not null), '[]'::jsonb)
    from public.orders o
    left join public.order_items oi on oi.order_id = o.id
    where o.order_number = upper(trim(p_order_number))
      and lower(o.customer_email) = lower(trim(p_customer_email))
      and o.user_id = auth.uid()
    group by o.id;
$$;

revoke all on function public.lookup_order_status(text, text) from public, anon;
grant execute on function public.lookup_order_status(text, text) to authenticated;

-- Only staff/admin may write product images.
drop policy if exists product_images_authenticated_upload on storage.objects;
create policy product_images_authenticated_upload on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and public.has_role('staff'));
drop policy if exists product_images_authenticated_update on storage.objects;
create policy product_images_authenticated_update on storage.objects for update to authenticated using (bucket_id = 'product-images' and public.has_role('staff')) with check (bucket_id = 'product-images' and public.has_role('staff'));
drop policy if exists product_images_authenticated_delete on storage.objects;
create policy product_images_authenticated_delete on storage.objects for delete to authenticated using (bucket_id = 'product-images' and public.has_role('staff'));

-- Manual role assignment by a trusted operator only. Never expose this through the client:
-- update public.profiles set role = 'admin' where id = '<trusted-auth-user-uuid>';

-- Rollback guidance: review dependent policies first, then remove only objects introduced here:
-- drop trigger if exists profiles_prevent_privilege_change on public.profiles;
-- drop trigger if exists on_auth_user_created on auth.users;
-- drop function if exists public.prevent_profile_privilege_change();
-- drop function if exists public.handle_new_user();
-- drop function if exists public.has_role(text);
-- drop table if exists public.profiles;
-- alter table public.orders drop column if exists user_id;
-- Do not run rollback automatically; preserve production data and review dependencies first.
