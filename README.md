# Abbas Book Bank POS

GitHub-ready starter for a school bookshop POS. React + Vite on **Cloudflare Pages**, **Supabase** backend. Includes PIN login, admin/seller role routing, schools → grades → books, product catalog, and basic atomic checkout.

## 1. Create repository

Create a new **private** GitHub repository named `abbas-book-bank-pos`. Upload all files in this folder, preserving the directory structure, or run:

```bash
git init
git add .
git commit -m "Initial Abbas Book Bank POS"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/abbas-book-bank-pos.git
git push -u origin main
```

## 2. Supabase setup

1. Create a Supabase project.
2. In **Authentication → Providers → Anonymous**, enable anonymous sign-ins. Anonymous identities are used only to establish an authenticated session before PIN verification.
3. In **SQL Editor**, run `supabase/migrations/001_initial.sql`.
4. **Never put PINs in GitHub or React.** Provision your *new, private* PINs in Supabase SQL Editor (not in committed SQL):

```sql
insert into public.pin_credentials(role,pin_hash)
values
 ('admin',crypt('REPLACE_WITH_NEW_PRIVATE_ADMIN_PIN',gen_salt('bf'))),
 ('seller',crypt('REPLACE_WITH_NEW_PRIVATE_SELLER_PIN',gen_salt('bf')))
on conflict(role) do update set pin_hash=excluded.pin_hash;
```

5. Install Supabase CLI and link your project, then deploy `supabase/functions/verify-pin`. Keep JWT verification **enabled** for this function. Supabase automatically provides its URL, anon key and service role key to hosted Edge Functions. Do not expose the service role key in Cloudflare or frontend environment variables.
6. Use the Supabase **Project URL** and **publishable / anon key** as the frontend environment variables below.

**Security warning:** A public 6-digit PIN system is inherently weaker than individual credentials + MFA. This starter uses server-side hashing, per-anonymous-user lockout and eight-hour role sessions. Per-user lockout can be bypassed by creating fresh anonymous identities; before production, implement **IP/device-level rate limiting at Cloudflare**, CAPTCHA/Turnstile, individual staff identities, and MFA for admin. Do not use the PINs posted in chat as production secrets. Also configure anonymous-user cleanup and monitoring.

## 3. Local development

```bash
npm install
cp .env.example .env
npm run dev
```

Fill `.env` with:

```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

## 4. Cloudflare Pages

Connect your GitHub repo to Cloudflare Pages. Framework: **Vite**. Build command: `npm run build`. Output directory: `dist`. Add both `VITE_` environment variables in Pages settings. The `public/_redirects` file supports React Router navigation.

## 5. Important starter limitations

- **Inventory must be added before checkout.** The admin can add product records, but stock intake and branch assignment UI are not built yet. Seed stock through Supabase SQL Editor after adding products, for example:

```sql
insert into public.stock(branch_id,product_id,quantity)
select b.id,p.id,10 from public.branches b cross join public.products p
where b.name='Indus Mehran Society, Malir'
on conflict(branch_id,product_id) do update set quantity=excluded.quantity;
```

- Checkout currently uses the first branch alphabetically, not a selected counter. This is **not suitable for two-branch live use**. Branch-scoped roles, inventory intake/transfers, discount rules, refunds, proper receipts, customer records, shift closing, audit trail and idempotent checkout must be implemented before production.
- The starter uses a browser print view, **not** a formatted receipt template.
- A shared seller PIN cannot attribute sales to a specific employee. Individual accounts are recommended for accountability.
- Never use this starter for real financial transactions without testing RLS, transaction concurrency, access expiry and inventory accounting.

## Project files

- `src/App.jsx`: login, admin dashboard, seller POS, school and product management
- `src/style.css`: responsive UI
- `src/supabase.js`: frontend Supabase client
- `supabase/migrations/001_initial.sql`: schema, RLS and checkout RPC
- `supabase/functions/verify-pin/index.ts`: secure server-side PIN verification

## 5. Shop-specific seller authentication (version 0.2)

After seller PIN login, the app displays the active shop directory. The seller selects a shop and must enter its separate six-digit PIN before the POS appears. Admin PIN login opens the Admin Dashboard directly. Admins can create shops, reset shop PINs, and enable/disable shops under **Manage Shops**.

For a fresh database, apply migrations **in order**: `001_initial.sql`, then `002_shop_auth.sql`. For an existing database that already has 001, apply only 002. Deploy **both** Edge Functions: `verify-pin` and `verify-shop-pin`. Keep JWT verification enabled. The `shop_credentials` table is never readable by the frontend.

Provision initial shop PINs **privately in Supabase SQL Editor**, replacing placeholders with *new, private* values:

```sql
insert into public.shop_credentials(branch_id,pin_hash)
select id, crypt('REPLACE_WITH_PRIVATE_JAFFER_PIN',gen_salt('bf'))
from public.branches where name='Jaffer Tayyar'
on conflict(branch_id) do update set pin_hash=excluded.pin_hash,updated_at=now();

insert into public.shop_credentials(branch_id,pin_hash)
select id, crypt('REPLACE_WITH_PRIVATE_MEHRAN_PIN',gen_salt('bf'))
from public.branches where name='Mehran Society'
on conflict(branch_id) do update set pin_hash=excluded.pin_hash,updated_at=now();
```

**Never commit actual shop PINs, hashes, service-role keys or production secrets.** The shop PINs provided in chat should be rotated before production. A public six-digit PIN system remains vulnerable to distributed guessing unless protected by Cloudflare-level rate limiting and additional controls. Admin PIN should ideally require MFA.

**Limitations:** This version preserves the existing starter architecture and is not yet production-validated. Admin checkout is intentionally blocked until an explicit branch-selection flow is implemented. Existing sessions should be signed out after the migration. Shop management requires an authenticated Admin session. Verify database RLS and checkout in a real Supabase test project before using real sales.
