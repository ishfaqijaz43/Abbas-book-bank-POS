-- Apply after 001_initial.sql. Shop PIN values must be provisioned privately.
alter table public.branches add column if not exists enabled boolean not null default true;
alter table public.active_access add column if not exists branch_id uuid references public.branches(id);
create table if not exists public.shop_credentials (
 branch_id uuid primary key references public.branches(id) on delete cascade,
 pin_hash text not null,
 updated_at timestamptz not null default now()
);
revoke all on public.shop_credentials from anon,authenticated;
alter table public.shop_credentials enable row level security;
-- Existing initial branch spelling is normalized; no duplicate shop is created.
update public.branches set name='Mehran Society' where name='Indus Mehran Society, Malir';
update public.branches set name='Jaffer Tayyar' where name='Jaffer Tayyar, Malir';
-- Require a second PIN for seller access, but not for admin.
create or replace function public.current_pos_branch() returns uuid language sql stable security definer set search_path='' as $$
 select branch_id from public.active_access where user_id=auth.uid() and role='seller' and expires_at>now() limit 1
$$;
revoke all on function public.current_pos_branch() from public;
grant execute on function public.current_pos_branch() to authenticated;
-- A seller with only the first PIN may read the shop directory, but not business data.
create or replace function public.current_pos_role() returns text language sql stable security definer set search_path='' as $$
 select case when role='admin' then 'admin' when role='seller' and branch_id is not null then 'seller' else null end
 from public.active_access where user_id=auth.uid() and expires_at>now() limit 1
$$;
-- Keep the first PIN stage separate from shop verification.
create or replace function public.verify_pos_pin(p_user uuid,p_pin text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_attempt public.login_attempts%rowtype;v_role text;v_hash text;
begin
 if p_user is null or p_pin !~ '^[0-9]{6}$' then return jsonb_build_object('ok',false,'error','Invalid PIN');end if;
 insert into public.login_attempts(user_id) values(p_user) on conflict do nothing;
 select * into v_attempt from public.login_attempts where user_id=p_user for update;
 if v_attempt.locked_until>now() then return jsonb_build_object('ok',false,'error','Too many attempts. Try later.');end if;
 select role,pin_hash into v_role,v_hash from public.pin_credentials where enabled and pin_hash=public.crypt(p_pin,pin_hash) limit 1;
 if v_role is null then
  update public.login_attempts set failures=case when failures>=4 then 0 else failures+1 end,locked_until=case when failures>=4 then now()+interval '15 minutes' else null end,updated_at=now() where user_id=p_user;
  return jsonb_build_object('ok',false,'error','Invalid PIN');
 end if;
 update public.login_attempts set failures=0,locked_until=null,updated_at=now() where user_id=p_user;
 insert into public.active_access(user_id,role,branch_id,expires_at) values(p_user,v_role,null,now()+interval '8 hours')
 on conflict(user_id) do update set role=excluded.role,branch_id=null,expires_at=excluded.expires_at;
 return jsonb_build_object('ok',true,'role',v_role);
end $$;
revoke all on function public.verify_pos_pin(uuid,text) from public,anon,authenticated;
grant execute on function public.verify_pos_pin(uuid,text) to service_role;
-- Only service-role Edge Function may verify the second PIN.
create or replace function public.verify_shop_pin(p_user uuid,p_branch uuid,p_pin text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_attempt public.login_attempts%rowtype;v_hash text;
begin
 if p_user is null or p_branch is null or p_pin !~ '^[0-9]{6}$' then return jsonb_build_object('ok',false,'error','Invalid request');end if;
 insert into public.login_attempts(user_id) values(p_user) on conflict do nothing;
 select * into v_attempt from public.login_attempts where user_id=p_user for update;
 if v_attempt.locked_until>now() then return jsonb_build_object('ok',false,'error','Too many attempts. Try later.');end if;
 if not exists(select 1 from public.active_access where user_id=p_user and role='seller' and expires_at>now()) then return jsonb_build_object('ok',false,'error','Seller login required');end if;
 select c.pin_hash into v_hash from public.shop_credentials c join public.branches b on b.id=c.branch_id where b.id=p_branch and b.enabled;
 if v_hash is null or v_hash<>public.crypt(p_pin,v_hash) then
  update public.login_attempts set failures=case when failures>=4 then 0 else failures+1 end,locked_until=case when failures>=4 then now()+interval '15 minutes' else null end,updated_at=now() where user_id=p_user;
  return jsonb_build_object('ok',false,'error','Invalid shop PIN');
 end if;
 update public.login_attempts set failures=0,locked_until=null,updated_at=now() where user_id=p_user;
 update public.active_access set branch_id=p_branch,expires_at=now()+interval '8 hours' where user_id=p_user and role='seller';
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.verify_shop_pin(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.verify_shop_pin(uuid,uuid,text) to service_role;
-- Shop directory is available after seller's first PIN, without exposing PIN hashes.
drop policy if exists "read branches" on public.branches;
create policy "read branches" on public.branches for select to authenticated using (
 public.current_pos_role()='admin' or (enabled and exists(select 1 from public.active_access a where a.user_id=auth.uid() and a.role='seller' and a.expires_at>now()))
);
-- Branch management functions do not accept a role from the client.
create or replace function public.admin_manage_shop(p_action text,p_branch_id uuid default null,p_name text default null,p_pin text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if public.current_pos_role()<>'admin' then raise exception 'Admin only';end if;
 if p_pin !~ '^[0-9]{6}$' then raise exception 'Shop PIN must be six digits';end if;
 if p_action='create' then
  if length(trim(coalesce(p_name,'')))<2 then raise exception 'Shop name is required';end if;
  insert into public.branches(name) values(trim(p_name)) returning id into v_id;
 elsif p_action='reset' then
  select id into v_id from public.branches where id=p_branch_id;
  if v_id is null then raise exception 'Shop not found';end if;
 else raise exception 'Invalid action';end if;
 insert into public.shop_credentials(branch_id,pin_hash) values(v_id,public.crypt(p_pin,public.gen_salt('bf')))
 on conflict(branch_id) do update set pin_hash=excluded.pin_hash,updated_at=now();
 return v_id;
end $$;
revoke all on function public.admin_manage_shop(text,uuid,text,text) from public,anon;
grant execute on function public.admin_manage_shop(text,uuid,text,text) to authenticated;
create or replace function public.admin_set_shop_enabled(p_branch_id uuid,p_enabled boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if public.current_pos_role()<>'admin' then raise exception 'Admin only';end if;
 update public.branches set enabled=p_enabled where id=p_branch_id;
 if not found then raise exception 'Shop not found';end if;
 if not p_enabled then update public.active_access set branch_id=null where branch_id=p_branch_id and role='seller';end if;
end $$;
revoke all on function public.admin_set_shop_enabled(uuid,boolean) from public,anon;
grant execute on function public.admin_set_shop_enabled(uuid,boolean) to authenticated;
-- All seller sales must use their verified branch; no arbitrary branch from browser.
create or replace function public.checkout_sale(p_items jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_role text;v_id uuid;v_branch uuid;v_total numeric(12,2):=0;v_item record;v_price numeric(12,2);v_stock integer;
begin
 v_role:=public.current_pos_role();
 if v_role not in ('admin','seller') then raise exception 'Unauthorized';end if;
 if v_role='seller' then
  select a.branch_id into v_branch from public.active_access a join public.branches b on b.id=a.branch_id and b.enabled where a.user_id=auth.uid() and a.role='seller' and a.expires_at>now();
 else
  raise exception 'Admin checkout requires explicit shop selection; use seller flow';
 end if;
 if v_branch is null then raise exception 'Shop authentication required';end if;
 if jsonb_typeof(p_items)!='array' or jsonb_array_length(p_items)=0 or jsonb_array_length(p_items)>100 then raise exception 'Invalid cart';end if;
 if exists(select 1 from jsonb_array_elements(p_items) x where (x->>'quantity') !~ '^[1-9][0-9]{0,3}$' or (x->>'product_id') !~ '^[0-9a-fA-F-]{36}$') then raise exception 'Invalid item';end if;
 if (select count(*) from jsonb_array_elements(p_items))<>(select count(distinct x->>'product_id') from jsonb_array_elements(p_items) x) then raise exception 'Duplicate product';end if;
 for v_item in select (x->>'product_id')::uuid as product_id,(x->>'quantity')::integer as qty from jsonb_array_elements(p_items) x order by x->>'product_id' loop
  select price into v_price from public.products where id=v_item.product_id;
  if v_price is null then raise exception 'Product not found';end if;
  select quantity into v_stock from public.stock where branch_id=v_branch and product_id=v_item.product_id for update;
  if v_stock is null or v_stock<v_item.qty then raise exception 'Insufficient stock for product %',v_item.product_id;end if;
  v_total:=v_total+v_price*v_item.qty;
 end loop;
 insert into public.sales(seller_id,branch_id,total) values(auth.uid(),v_branch,v_total) returning id into v_id;
 for v_item in select (x->>'product_id')::uuid as product_id,(x->>'quantity')::integer as qty from jsonb_array_elements(p_items) x order by x->>'product_id' loop
  select price into v_price from public.products where id=v_item.product_id;
  update public.stock set quantity=quantity-v_item.qty where branch_id=v_branch and product_id=v_item.product_id;
  insert into public.sale_items(sale_id,product_id,quantity,unit_price) values(v_id,v_item.product_id,v_item.qty,v_price);
 end loop;
 return jsonb_build_object('sale_id',v_id,'total',v_total,'branch_id',v_branch);
end $$;
revoke all on function public.checkout_sale(jsonb) from public,anon;
grant execute on function public.checkout_sale(jsonb) to authenticated;
-- Sellers may only see inventory belonging to their verified shop.
drop policy if exists "read stock" on public.stock;
create policy "read stock" on public.stock for select to authenticated using(public.current_pos_role()='admin' or (public.current_pos_role()='seller' and branch_id=public.current_pos_branch()));
-- Seller's sales are restricted to their active shop.
drop policy if exists "read sales" on public.sales;
create policy "read sales" on public.sales for select to authenticated using(public.current_pos_role()='admin' or (public.current_pos_role()='seller' and seller_id=auth.uid() and branch_id=public.current_pos_branch()));
