-- Migration 007: Link documents (e.g. invoices) to a specific budget line item
-- Run this in the Supabase SQL editor against an existing REI HQ database
-- that already has migration 006 applied. Lets a photo/PDF uploaded from a
-- budget line item's row be tied directly to that expense, alongside the
-- existing project-wide document uploader.

alter table renovation_documents add column if not exists line_item_id uuid references renovation_line_items(id) on delete set null;
