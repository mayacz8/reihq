# REI HQ

A single app to run a buy-renovate-rent real estate operation: acquisition
pipeline, renovation project management, rental/tenant management, and
portfolio financials, with role-based access for your team.

Built with Next.js (App Router) + Supabase (Postgres, auth, row-level
security). Everything reads/writes the same database, so the dashboard,
property pages, and reports stay in sync automatically.

## What's included

- **Dashboard** — portfolio-wide stats: property count, estimated value, active
  renovations, open deals, occupancy, rent roll, month-to-date income/expense.
- **Acquisition** (`/deals`) — pipeline of prospective deals from sourcing
  through closed won/lost, with asking price, ARV, estimated reno cost and rent.
- **Properties** (`/properties`) — every property you own or are acquiring,
  with a detail page rolling up its renovation projects, leases, and recent
  transactions.
- **Renovations** (`/renovations`) — projects per property with budget vs.
  actual (via line items), tasks, and contractor assignments.
- **Rentals** (`/rentals`) — tenants, leases, and the rent roll.
- **Financials** (`/financials`) — income/expense ledger per property, rolling
  up into a simple P&L.
- **Roles** — `owner`, `property_manager`, `contractor`, `bookkeeper`. Owners
  see everything. Everyone else only sees the properties and modules they've
  been explicitly granted (see `property_team_access` in the schema).

## 1. Set up Supabase (5 minutes)

1. Create a free project at [supabase.com](https://supabase.com).
2. In the Supabase dashboard, go to **SQL Editor** → paste the contents of
   `supabase/schema.sql` → run it. This creates every table, the roles, and
   the row-level security policies.
3. Go to **Project Settings → API** and copy the **Project URL** and
   **anon public key**.
4. Go to **Authentication → Providers** and make sure **Email** is enabled
   (it is by default). You can turn off "Confirm email" while testing so
   sign-up is instant.

## 2. Configure the app

```bash
cp .env.example .env.local
```

Fill in `.env.local` with the URL and anon key from step 1.

## 3. Run it locally

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`, click **Sign up**, and create your account.

Then, back in the Supabase SQL Editor, promote yourself to owner (owners see
and manage everything; every other role is scoped to what you grant them):

```sql
update profiles set role = 'owner' where email = 'you@yourdomain.com';
```

## 4. Deploy it for real, multi-user use

1. Push this folder to a GitHub repo.
2. Go to [vercel.com](https://vercel.com) → **New Project** → import the repo.
3. Add the same two environment variables from `.env.local` in Vercel's
   project settings.
4. Deploy. Vercel gives you a live URL you can share.

## 5. Add your team

Each person creates their own account by signing up on the live URL (they'll
default to `property_manager` role — change via SQL if you want a different
default). To give someone scoped access to a specific property:

```sql
insert into property_team_access (property_id, user_id, access_scope)
values ('<property-uuid>', '<their-user-uuid>', 'renovation');
-- access_scope: 'full' | 'renovation' | 'rentals' | 'financials' | 'readonly'
```

Example: give your contractor `renovation`-only access to one property, your
bookkeeper `financials`-only access to every property, and your property
manager `full` access to the properties they run day to day.

## Extending it

The schema (`supabase/schema.sql`) is deliberately readable — add columns or
tables directly in SQL, or ask an AI coding assistant to extend the Next.js
pages in `app/` to match. Natural next additions once the basics feel right:

- File/photo uploads (Supabase Storage) for before/after renovation photos
  and lease documents.
- Automated rent payment reminders (Supabase Edge Functions + a cron trigger,
  or a service like Resend for email).
- A calendar view for renovation task due dates and lease end dates.
- CSV export of the financials ledger for tax prep.
- Syncing rent payments automatically via a payment processor (Stripe,
  Plaid) instead of logging them by hand.
