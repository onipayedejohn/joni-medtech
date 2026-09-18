-- Joni Medtech Supply product pricing migration
-- Review and run manually in Supabase SQL Editor.
-- Existing price values remain the current selling prices.

alter table public.products
    add column if not exists original_price numeric(12, 2),
    add column if not exists discount_percent numeric(5, 2) not null default 0;

update public.products
set original_price = price
where original_price is null;

alter table public.products
    alter column original_price set default 0,
    alter column original_price set not null;

alter table public.products
    drop constraint if exists products_original_price_check;
alter table public.products
    add constraint products_original_price_check check (original_price >= 0);

alter table public.products
    drop constraint if exists products_discount_percent_check;
alter table public.products
    add constraint products_discount_percent_check check (discount_percent >= 0 and discount_percent <= 100);

alter table public.products
    drop constraint if exists products_sale_price_check;
alter table public.products
    add constraint products_sale_price_check check (price <= original_price);

-- Existing products keep their current selling price and receive no discount
-- unless you explicitly update original_price and discount_percent.
