-- REI HQ database schema
-- Run this in the Supabase SQL editor on a fresh project.
-- Covers: acquisition/deals, renovation project management, rental/tenant
-- management, and portfolio-wide financials, with role-based access.

-- ============================================================
-- 1. PROFILES & ACCESS
-- ============================================================

create type user_role as enum ('owner', 'property_manager', 'contractor', 'bookkeeper');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role user_role not null default 'property_manager',
  phone text,
  created_at timestamptz not null default now()
);

-- Grants a non-owner user access to a specific property, scoped to what
-- they're allowed to touch. 'full' = everything on that property.
create table property_team_access (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null,
  user_id uuid not null references profiles(id) on delete cascade,
  access_scope text not null default 'full'
    check (access_scope in ('full', 'renovation', 'rentals', 'financials', 'readonly')),
  created_at timestamptz not null default now(),
  unique (property_id, user_id)
);

-- ============================================================
-- 2. PROPERTIES
-- ============================================================

create type property_status as enum (
  'prospect', 'under_contract', 'owned_renovating', 'owned_rented', 'owned_vacant', 'sold'
);

create table properties (
  id uuid primary key default gen_random_uuid(),
  address text not null,
  unit text,
  city text,
  state text,
  zip text,
  status property_status not null default 'prospect',
  purchase_price numeric(12,2),
  purchase_date date,
  closing_costs numeric(12,2),
  arv_estimate numeric(12,2),
  current_value_estimate numeric(12,2),
  sqft integer,
  beds numeric(3,1),
  baths numeric(3,1),
  year_built integer,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table property_team_access
  add constraint property_team_access_property_fk
  foreign key (property_id) references properties(id) on delete cascade;

-- Loans / financing tied to a property
create table loans (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  lender text,
  loan_type text, -- e.g. conventional, hard money, HELOC, seller financing
  original_amount numeric(12,2),
  interest_rate numeric(5,3),
  term_months integer,
  monthly_payment numeric(10,2),
  origination_date date,
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 3. ACQUISITION / DEAL PIPELINE
-- ============================================================

create type deal_stage as enum (
  'sourcing', 'analyzing', 'offer_submitted', 'under_contract', 'closed_won', 'closed_lost'
);

create table deals (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id) on delete set null,
  address text not null,
  city text,
  state text,
  source text, -- MLS, wholesaler, off-market, driving for dollars, referral...
  asking_price numeric(12,2),
  offer_price numeric(12,2),
  arv_estimate numeric(12,2),
  estimated_reno_cost numeric(12,2),
  estimated_monthly_rent numeric(10,2),
  stage deal_stage not null default 'sourcing',
  target_close_date date,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 4. RENOVATION / PROJECT MANAGEMENT
-- ============================================================

create table contractors (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text,
  phone text,
  email text,
  trade text, -- e.g. electrical, plumbing, general, roofing
  license_number text,
  insurance_verified boolean not null default false,
  insurance_expiry date,
  rating integer check (rating between 1 and 5),
  is_preferred boolean not null default false,
  reliability_notes text,
  notes text,
  created_at timestamptz not null default now()
);

create type project_status as enum ('planning', 'in_progress', 'on_hold', 'complete');

create table renovation_projects (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  name text not null,
  status project_status not null default 'planning',
  budget_total numeric(12,2),
  contingency_amount numeric(12,2) not null default 0,
  start_date date,
  target_end_date date,
  actual_end_date date,
  notes text,
  created_at timestamptz not null default now()
);

create table renovation_line_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references renovation_projects(id) on delete cascade,
  category text not null, -- e.g. kitchen, roof, flooring, permits
  description text,
  budgeted_amount numeric(12,2) not null default 0,
  actual_amount numeric(12,2) not null default 0,
  contractor_id uuid references contractors(id),
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'complete')),
  created_at timestamptz not null default now()
);

create table renovation_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references renovation_projects(id) on delete cascade,
  title text not null,
  assigned_contractor_id uuid references contractors(id),
  start_date date,
  due_date date,
  status text not null default 'todo'
    check (status in ('todo', 'in_progress', 'done')),
  notes text,
  created_at timestamptz not null default now()
);

-- Multiple contractor quotes per line item, so bids can be compared before
-- picking one.
create table renovation_bids (
  id uuid primary key default gen_random_uuid(),
  line_item_id uuid not null references renovation_line_items(id) on delete cascade,
  contractor_id uuid not null references contractors(id),
  amount numeric(12,2) not null,
  submitted_date date not null default current_date,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  notes text,
  created_at timestamptz not null default now()
);

-- Scope/cost changes tracked separately from the original budget.
create table change_orders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references renovation_projects(id) on delete cascade,
  line_item_id uuid references renovation_line_items(id) on delete set null,
  description text not null,
  cost_delta numeric(12,2) not null,
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'rejected')),
  requested_date date not null default current_date,
  approved_date date,
  notes text,
  created_at timestamptz not null default now()
);

create table permits (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references renovation_projects(id) on delete cascade,
  permit_type text not null,
  permit_number text,
  status text not null default 'not_applied'
    check (status in ('not_applied', 'applied', 'issued', 'inspection_scheduled', 'passed', 'failed', 'closed')),
  applied_date date,
  issued_date date,
  inspection_date date,
  inspection_result text,
  notes text,
  created_at timestamptz not null default now()
);

-- Design/finish selection sheet: what paint, flooring, countertops, fixtures,
-- etc. were chosen per room, for reference or replication later.
create table finish_selections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references renovation_projects(id) on delete cascade,
  room text,
  category text not null,
  item_name text not null,
  brand text,
  color_finish text,
  sku_model text,
  vendor text,
  cost numeric(12,2),
  quantity numeric(10,2),
  status text not null default 'selected'
    check (status in ('considering', 'selected', 'ordered', 'installed')),
  spec_url text,
  notes text,
  created_at timestamptz not null default now()
);

-- Photos, invoices, permit docs, etc. Files live in Supabase Storage; this
-- table indexes them against a project/line item/task/permit/finish.
create table renovation_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references renovation_projects(id) on delete cascade,
  line_item_id uuid references renovation_line_items(id) on delete set null,
  task_id uuid references renovation_tasks(id) on delete set null,
  permit_id uuid references permits(id) on delete set null,
  finish_selection_id uuid references finish_selections(id) on delete set null,
  doc_type text not null default 'photo' check (doc_type in ('photo', 'invoice', 'permit', 'inspection', 'other')),
  file_url text not null,
  file_name text,
  caption text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- Furniture/FF&E cost for properties rented out furnished, tracked separately
-- from the renovation budget.
create table furnishings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  item_name text not null,
  vendor text,
  category text not null default 'package'
    check (category in ('package', 'furniture', 'appliance', 'decor', 'electronics', 'other')),
  cost numeric(12,2) not null,
  purchase_date date not null default current_date,
  warranty_expiry date,
  condition text not null default 'new'
    check (condition in ('new', 'good', 'fair', 'needs_replacement')),
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 5. RENTAL / TENANT MANAGEMENT
-- ============================================================

create table tenants (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);

create type lease_status as enum ('pending', 'active', 'ended');

create table leases (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  start_date date not null,
  end_date date,
  monthly_rent numeric(10,2) not null,
  security_deposit numeric(10,2),
  status lease_status not null default 'pending',
  notes text,
  created_at timestamptz not null default now()
);

create table rent_payments (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references leases(id) on delete cascade,
  due_date date not null,
  amount_due numeric(10,2) not null,
  amount_paid numeric(10,2) not null default 0,
  paid_date date,
  status text not null default 'unpaid'
    check (status in ('paid', 'partial', 'late', 'unpaid')),
  notes text,
  created_at timestamptz not null default now()
);

create table maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  lease_id uuid references leases(id) on delete set null,
  title text not null,
  description text,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  reported_date date not null default current_date,
  resolved_date date,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 6. FINANCIALS
-- ============================================================

create type transaction_type as enum ('income', 'expense');

create table transactions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  type transaction_type not null,
  category text not null, -- rent, mortgage, insurance, taxes, repairs, capex, management_fee, other
  amount numeric(12,2) not null,
  date date not null default current_date,
  description text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- 7. HELPER FUNCTIONS FOR ROW LEVEL SECURITY
-- ============================================================

create or replace function current_role_is_owner()
returns boolean language sql stable as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'owner'
  );
$$;

create or replace function has_property_scope(p_property_id uuid, p_scopes text[])
returns boolean language sql stable as $$
  select current_role_is_owner() or exists (
    select 1 from property_team_access
    where property_id = p_property_id
      and user_id = auth.uid()
      and (access_scope = 'full' or access_scope = any(p_scopes))
  );
$$;

-- ============================================================
-- 8. ENABLE RLS + POLICIES
-- ============================================================

alter table profiles enable row level security;
alter table property_team_access enable row level security;
alter table properties enable row level security;
alter table loans enable row level security;
alter table deals enable row level security;
alter table contractors enable row level security;
alter table renovation_projects enable row level security;
alter table renovation_line_items enable row level security;
alter table renovation_tasks enable row level security;
alter table renovation_bids enable row level security;
alter table change_orders enable row level security;
alter table permits enable row level security;
alter table finish_selections enable row level security;
alter table renovation_documents enable row level security;
alter table furnishings enable row level security;
alter table tenants enable row level security;
alter table leases enable row level security;
alter table rent_payments enable row level security;
alter table maintenance_requests enable row level security;
alter table transactions enable row level security;

-- Profiles: everyone can see all profiles (for assigning/contact info),
-- but only edit their own.
create policy "profiles_select_all" on profiles for select using (true);
create policy "profiles_update_self" on profiles for update using (id = auth.uid());

-- Owner-only tables (deal pipeline & team access are strategic/owner-level)
create policy "deals_owner_all" on deals for all using (current_role_is_owner());
create policy "team_access_owner_all" on property_team_access for all using (current_role_is_owner());
create policy "contractors_read_all" on contractors for select using (true);
create policy "contractors_owner_write" on contractors for insert with check (current_role_is_owner());
create policy "contractors_owner_update" on contractors for update using (current_role_is_owner());

-- Properties: owner full access; team members with any scope can view.
create policy "properties_owner_all" on properties for all using (current_role_is_owner());
create policy "properties_team_select" on properties for select using (
  has_property_scope(id, array['full','renovation','rentals','financials','readonly'])
);

-- Loans: owner + financials scope
create policy "loans_owner_all" on loans for all using (current_role_is_owner());
create policy "loans_financials_select" on loans for select using (
  has_property_scope(property_id, array['financials','readonly'])
);

-- Renovation projects / line items / tasks: owner + renovation scope (read/write)
create policy "reno_projects_owner_all" on renovation_projects for all using (current_role_is_owner());
create policy "reno_projects_scoped" on renovation_projects for all using (
  has_property_scope(property_id, array['renovation'])
);

create policy "reno_items_owner_all" on renovation_line_items for all using (
  current_role_is_owner()
);
create policy "reno_items_scoped" on renovation_line_items for all using (
  exists (
    select 1 from renovation_projects rp
    where rp.id = renovation_line_items.project_id
      and has_property_scope(rp.property_id, array['renovation'])
  )
);

create policy "reno_tasks_owner_all" on renovation_tasks for all using (
  current_role_is_owner()
);
create policy "reno_tasks_scoped" on renovation_tasks for all using (
  exists (
    select 1 from renovation_projects rp
    where rp.id = renovation_tasks.project_id
      and has_property_scope(rp.property_id, array['renovation'])
  )
);

create policy "bids_owner_all" on renovation_bids for all using (current_role_is_owner());
create policy "bids_scoped" on renovation_bids for all using (
  exists (
    select 1 from renovation_line_items li
    join renovation_projects rp on rp.id = li.project_id
    where li.id = renovation_bids.line_item_id
      and has_property_scope(rp.property_id, array['renovation'])
  )
);

create policy "change_orders_owner_all" on change_orders for all using (current_role_is_owner());
create policy "change_orders_scoped" on change_orders for all using (
  exists (
    select 1 from renovation_projects rp
    where rp.id = change_orders.project_id
      and has_property_scope(rp.property_id, array['renovation'])
  )
);

create policy "permits_owner_all" on permits for all using (current_role_is_owner());
create policy "permits_scoped" on permits for all using (
  exists (
    select 1 from renovation_projects rp
    where rp.id = permits.project_id
      and has_property_scope(rp.property_id, array['renovation'])
  )
);

create policy "finish_selections_owner_all" on finish_selections for all using (current_role_is_owner());
create policy "finish_selections_scoped" on finish_selections for all using (
  exists (
    select 1 from renovation_projects rp
    where rp.id = finish_selections.project_id
      and has_property_scope(rp.property_id, array['renovation'])
  )
);

create policy "documents_owner_all" on renovation_documents for all using (current_role_is_owner());
create policy "documents_scoped" on renovation_documents for all using (
  exists (
    select 1 from renovation_projects rp
    where rp.id = renovation_documents.project_id
      and has_property_scope(rp.property_id, array['renovation'])
  )
);

create policy "furnishings_owner_all" on furnishings for all using (current_role_is_owner());
create policy "furnishings_scoped" on furnishings for all using (
  has_property_scope(property_id, array['renovation', 'financials'])
);

-- Tenants: owner + rentals scope
create policy "tenants_owner_all" on tenants for all using (current_role_is_owner());
create policy "tenants_read_all" on tenants for select using (true);

-- Leases / rent payments / maintenance: owner + rentals scope
create policy "leases_owner_all" on leases for all using (current_role_is_owner());
create policy "leases_scoped" on leases for all using (
  has_property_scope(property_id, array['rentals'])
);

create policy "rent_payments_owner_all" on rent_payments for all using (
  current_role_is_owner()
);
create policy "rent_payments_scoped" on rent_payments for all using (
  exists (
    select 1 from leases l
    where l.id = rent_payments.lease_id
      and has_property_scope(l.property_id, array['rentals','financials'])
  )
);

create policy "maintenance_owner_all" on maintenance_requests for all using (
  current_role_is_owner()
);
create policy "maintenance_scoped" on maintenance_requests for all using (
  has_property_scope(property_id, array['rentals','renovation'])
);

-- Transactions: owner + financials scope
create policy "transactions_owner_all" on transactions for all using (current_role_is_owner());
create policy "transactions_scoped" on transactions for all using (
  has_property_scope(property_id, array['financials'])
);

-- ============================================================
-- 9. AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', 'property_manager');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- 10. STORAGE (renovation photos, invoices, permits)
-- ============================================================

insert into storage.buckets (id, name, public)
values ('renovation-docs', 'renovation-docs', true)
on conflict (id) do nothing;

create policy "renovation_docs_read" on storage.objects for select using (bucket_id = 'renovation-docs');
create policy "renovation_docs_write" on storage.objects for insert with check (bucket_id = 'renovation-docs' and auth.role() = 'authenticated');
create policy "renovation_docs_delete" on storage.objects for delete using (bucket_id = 'renovation-docs' and auth.role() = 'authenticated');

-- After running this file, manually promote yourself to owner:
-- update profiles set role = 'owner' where email = 'you@example.com';
