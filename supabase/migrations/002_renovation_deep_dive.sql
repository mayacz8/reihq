-- Migration 002: Renovation deep dive
-- Run this in the Supabase SQL editor against an existing REI HQ database
-- (one that already has schema.sql applied). Adds: contractor bids and
-- reliability info, change orders + contingency, permits/inspections,
-- document/photo uploads, and task scheduling.

-- 1. Extend contractors with reliability/license/insurance info
alter table contractors add column if not exists license_number text;
alter table contractors add column if not exists insurance_verified boolean not null default false;
alter table contractors add column if not exists insurance_expiry date;
alter table contractors add column if not exists rating integer check (rating between 1 and 5);
alter table contractors add column if not exists is_preferred boolean not null default false;
alter table contractors add column if not exists reliability_notes text;

-- 2. Extend renovation_projects with a contingency budget
alter table renovation_projects add column if not exists contingency_amount numeric(12,2) not null default 0;

-- 3. Extend renovation_tasks with a start date, for schedule/calendar views
alter table renovation_tasks add column if not exists start_date date;

-- 4. Bids - log multiple contractor quotes per line item before picking one
create table if not exists renovation_bids (
  id uuid primary key default gen_random_uuid(),
  line_item_id uuid not null references renovation_line_items(id) on delete cascade,
  contractor_id uuid not null references contractors(id),
  amount numeric(12,2) not null,
  submitted_date date not null default current_date,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  notes text,
  created_at timestamptz not null default now()
);

-- 5. Change orders - scope/cost changes tracked separately from original budget
create table if not exists change_orders (
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

-- 6. Permits & inspections
create table if not exists permits (
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

-- 7. Design & finishes - the selection/spec sheet for a renovation: what
-- paint, flooring, countertops, fixtures, etc. were chosen per room, so it's
-- easy to reference or replicate later (repairs, consistency across units).
create table if not exists finish_selections (
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

alter table finish_selections enable row level security;
drop policy if exists "finish_selections_owner_all" on finish_selections;
create policy "finish_selections_owner_all" on finish_selections for all using (current_role_is_owner());
drop policy if exists "finish_selections_scoped" on finish_selections;
create policy "finish_selections_scoped" on finish_selections for all using (
  exists (
    select 1 from renovation_projects rp
    where rp.id = finish_selections.project_id
      and has_property_scope(rp.property_id, array['renovation'])
  )
);

-- 8. Documents (photos, invoices, permit docs, other) - files live in Supabase
-- Storage, this table just indexes them against a project/line item/task/permit/finish.
create table if not exists renovation_documents (
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

-- 8. RLS - same pattern as the rest of the renovation module: owners see
-- everything, everyone else needs 'renovation' scope on the property.
alter table renovation_bids enable row level security;
alter table change_orders enable row level security;
alter table permits enable row level security;
alter table renovation_documents enable row level security;

drop policy if exists "bids_owner_all" on renovation_bids;
create policy "bids_owner_all" on renovation_bids for all using (current_role_is_owner());
drop policy if exists "bids_scoped" on renovation_bids;
create policy "bids_scoped" on renovation_bids for all using (
  exists (
    select 1 from renovation_line_items li
    join renovation_projects rp on rp.id = li.project_id
    where li.id = renovation_bids.line_item_id
      and has_property_scope(rp.property_id, array['renovation'])
  )
);

drop policy if exists "change_orders_owner_all" on change_orders;
create policy "change_orders_owner_all" on change_orders for all using (current_role_is_owner());
drop policy if exists "change_orders_scoped" on change_orders;
create policy "change_orders_scoped" on change_orders for all using (
  exists (
    select 1 from renovation_projects rp
    where rp.id = change_orders.project_id
      and has_property_scope(rp.property_id, array['renovation'])
  )
);

drop policy if exists "permits_owner_all" on permits;
create policy "permits_owner_all" on permits for all using (current_role_is_owner());
drop policy if exists "permits_scoped" on permits;
create policy "permits_scoped" on permits for all using (
  exists (
    select 1 from renovation_projects rp
    where rp.id = permits.project_id
      and has_property_scope(rp.property_id, array['renovation'])
  )
);

drop policy if exists "documents_owner_all" on renovation_documents;
create policy "documents_owner_all" on renovation_documents for all using (current_role_is_owner());
drop policy if exists "documents_scoped" on renovation_documents;
create policy "documents_scoped" on renovation_documents for all using (
  exists (
    select 1 from renovation_projects rp
    where rp.id = renovation_documents.project_id
      and has_property_scope(rp.property_id, array['renovation'])
  )
);

-- 9. Furnishings - for properties rented out furnished, track the cost of
-- furnishing/buying out the unit (furniture packages, individual items, or
-- appliances) separately from the renovation budget itself.
create table if not exists furnishings (
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

alter table furnishings enable row level security;
drop policy if exists "furnishings_owner_all" on furnishings;
create policy "furnishings_owner_all" on furnishings for all using (current_role_is_owner());
drop policy if exists "furnishings_scoped" on furnishings;
create policy "furnishings_scoped" on furnishings for all using (
  has_property_scope(property_id, array['renovation', 'financials'])
);

-- 10. Storage bucket for renovation photos/invoices/permits
insert into storage.buckets (id, name, public)
values ('renovation-docs', 'renovation-docs', true)
on conflict (id) do nothing;

drop policy if exists "renovation_docs_read" on storage.objects;
create policy "renovation_docs_read" on storage.objects for select using (bucket_id = 'renovation-docs');
drop policy if exists "renovation_docs_write" on storage.objects;
create policy "renovation_docs_write" on storage.objects for insert with check (bucket_id = 'renovation-docs' and auth.role() = 'authenticated');
drop policy if exists "renovation_docs_delete" on storage.objects;
create policy "renovation_docs_delete" on storage.objects for delete using (bucket_id = 'renovation-docs' and auth.role() = 'authenticated');
