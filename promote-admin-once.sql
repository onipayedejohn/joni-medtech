-- One-time operator action for the existing account.
-- Review and run manually in Supabase SQL Editor.
-- This is not loaded by the browser and is not part of client-side authorization.
-- It does not expose credentials or change any other user's role.

begin;

-- Permit this trusted SQL Editor operation while keeping browser users protected.
create or replace function public.prevent_profile_privilege_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
	if new.role is distinct from old.role or new.is_active is distinct from old.is_active then
		if auth.uid() is not null and not public.has_role('admin') then
			raise exception 'Only an administrator can change profile privileges';
		end if;
	end if;
	return new;
end;
$$;

insert into public.profiles (id, full_name, role)
select id, coalesce(raw_user_meta_data ->> 'full_name', ''), 'admin'
from auth.users
where lower(email) = lower('onipayedejohn11@gmail.com')
on conflict (id) do update
set role = 'admin', is_active = true, updated_at = now();

commit;

-- Verify after running:
-- select p.id, u.email, p.role, p.is_active
-- from public.profiles p
-- join auth.users u on u.id = p.id
-- where lower(u.email) = lower('onipayedejohn11@gmail.com');

-- Rollback this one-time promotion if needed:
-- update public.profiles
-- set role = 'customer', updated_at = now()
-- where id = (select id from auth.users where lower(email) = lower('onipayedejohn11@gmail.com'));
