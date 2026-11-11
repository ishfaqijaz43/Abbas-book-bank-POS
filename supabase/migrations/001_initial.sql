-- Run in Supabase SQL editor. Requires pgcrypto (available on Supabase).
create extension if not exists pgcrypto;
create table public.pin_credentials (
 role text primary key check (role in ('admin','seller')),
 pin_hash text not null,
 enabled boolean not null default true
);
revoke all on public.pin_credentials from anon, authenticated;
create table public.active_access (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check (role in ('admin','seller')),
 expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
create table public.login_attempts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 failures integer not null default 0,
 locked_until timestamptz,
 updated_at timestamptz not null default now()
);
revoke all on public.login_attempts from anon, authenticated;
create function public.current_pos_role() returns text language sql stable security definer set search_path = '' as $$
 select role from public.active_access where user_id=auth.uid() and expires_at>now() limit 1
$$;
revoke all on function public.current_pos_role() from public;
grant execute on function public.current_pos_role() to authenticated;
create table public.schools (id uuid primary key default gen_random_uuid(),name text not null unique,created_at timestamptz not null default now());
create table public.grades (id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id) on delete cascade,name text not null,unique(school_id,name));
create table public.products (id uuid primary key default gen_random_uuid(),name text not null,sku text unique,price numeric(12,2) not null check(price>=0),created_at timestamptz not null default now());
create table public.grade_books (id uuid primary key default gen_random_uuid(),grade_id uuid not null references public.grades(id) on delete cascade,product_id uuid not null references public.products(id),quantity integer not null default 1 check(quantity>0),unique(grade_id,product_id));
create table public.branches (id uuid primary key default gen_random_uuid(),name text not null unique);
insert into public.branches(name) values ('Jaffer Tayyar, Malir'),('Indus Mehran Society, Malir');
create table public.stock (branch_id uuid not null references public.branches(id),product_id uuid not null references public.products(id),quantity integer not null default 0 check(quantity>=0),primary key(branch_id,product_id));
create table public.sales (id uuid primary key default gen_random_uuid(),seller_id uuid not null references auth.users(id),branch_id uuid references public.branches(id),total numeric(12,2) not null check(total>=0),created_at timestamptz not null default now());
create table public.sale_items (id uuid primary key default gen_random_uuid(),sale_id uuid not null references public.sales(id) on delete cascade,product_id uuid not null references public.products(id),quantity integer not null check(quantity>0),unit_price numeric(12,2) not null check(unit_price>=0));
-- PIN verification is exclusively through the Edge Function using the service role.
create or replace function public.verify_pos_pin(p_user uuid,p_pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_attempt public.login_attempts%rowtype; v_role text; v_hash text;
begin
 if p_user is null or p_pin !~ '^[0-9]{6}$' then return jsonb_build_object('ok',false,'error','Invalid PIN'); end if;
 insert into public.login_attempts(user_id) values(p_user) on conflict do nothing;
 select * into v_attempt from public.login_attempts where user_id=p_user for update;
 if v_attempt.locked_until>now() then return jsonb_build_object('ok',false,'error','Too many attempts. Try later.'); end if;
 select role,pin_hash into v_role,v_hash from public.pin_credentials where enabled and pin_hash=public.crypt(p_pin,pin_hash) limit 1;
 if v_role is null then
  update public.login_attempts set failures=case when failures>=4 then 0 else failures+1 end,locked_until=case when failures>=4 then now()+interval '15 minutes' else null end,updated_at=now() where user_id=p_user;
  return jsonb_build_object('ok',false,'error','Invalid PIN');
 end if;
 update public.login_attempts set failures=0,locked_until=null,updated_at=now() where user_id=p_user;
 insert into public.active_access(user_id,role,expires_at) values(p_user,v_role,now()+interval '8 hours') on conflict(user_id) do update set role=excluded.role,expires_at=excluded.expires_at;
 return jsonb_build_object('ok',true,'role',v_role);
end $$;
revoke all on function public.verify_pos_pin(uuid,text) from public,anon,authenticated;
-- Restrict access to the Edge Function's service role.
grant execute on function public.verify_pos_pin(uuid,text) to service_role;
alter table public.pin_credentials enable row level security;
alter table public.active_access enable row level security;
alter table public.login_attempts enable row level security;
alter table public.schools enable row level security;
alter table public.grades enable row level security;
alter table public.products enable row level security;
alter table public.grade_books enable row level security;
alter table public.branches enable row level security;
alter table public.stock enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
create policy "own session" on public.active_access for select to authenticated using(user_id=auth.uid() and expires_at>now());
create policy "read schools" on public.schools for select to authenticated using(public.current_pos_role() in ('admin','seller'));
create policy "admin schools" on public.schools for all to authenticated using(public.current_pos_role()='admin') with check(public.current_pos_role()='admin');
create policy "read grades" on public.grades for select to authenticated using(public.current_pos_role() in ('admin','seller'));
create policy "admin grades" on public.grades for all to authenticated using(public.current_pos_role()='admin') with check(public.current_pos_role()='admin');
create policy "read products" on public.products for select to authenticated using(public.current_pos_role() in ('admin','seller'));
create policy "admin products" on public.products for all to authenticated using(public.current_pos_role()='admin') with check(public.current_pos_role()='admin');
create policy "read grade books" on public.grade_books for select to authenticated using(public.current_pos_role() in ('admin','seller'));
create policy "admin grade books" on public.grade_books for all to authenticated using(public.current_pos_role()='admin') with check(public.current_pos_role()='admin');
create policy "read branches" on public.branches for select to authenticated using(public.current_pos_role() in ('admin','seller'));
create policy "read stock" on public.stock for select to authenticated using(public.current_pos_role() in ('admin','seller'));
create policy "admin stock" on public.stock for all to authenticated using(public.current_pos_role()='admin') with check(public.current_pos_role()='admin');
create policy "read sales" on public.sales for select to authenticated using(public.current_pos_role()='admin' or (public.current_pos_role()='seller' and seller_id=auth.uid()));
create policy "read sale items" on public.sale_items for select to authenticated using(exists(select 1 from public.sales s where s.id=sale_id));
-- Checkout is a single atomic database transaction. Never trust client-submitted prices.
create function public.checkout_sale(p_items jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_role text;v_id uuid;v_branch uuid;v_total numeric(12,2):=0;v_item record;v_price numeric(12,2);v_qty integer;v_stock integer;
begin
 v_role:=public.current_pos_role();
 if v_role not in ('admin','seller') then raise exception 'Unauthorized';end if;
 if jsonb_typeof(p_items)!='array' or jsonb_array_length(p_items)=0 or jsonb_array_length(p_items)>100 then raise exception 'Invalid cart';end if;
 if exists(select 1 from jsonb_array_elements(p_items) x where (x->>'quantity') !~ '^[1-9][0-9]{0,3}$' or (x->>'product_id') !~ '^[0-9a-fA-F-]{36}$') then raise exception 'Invalid item';end if;
 if (select count(*) from jsonb_array_elements(p_items))<>(select count(distinct x->>'product_id') from jsonb_array_elements(p_items) x) then raise exception 'Duplicate product';end if;
 select id into v_branch from public.branches order by name limit 1;
 -- Phase 1: reserve stock under row locks; every item must have a stock record.
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
 return jsonb_build_object('sale_id',v_id,'total',v_total);
end $$;
revoke all on function public.checkout_sale(jsonb) from public,anon;
grant execute on function public.checkout_sale(jsonb) to authenticated;
