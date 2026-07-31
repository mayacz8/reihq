-- Migration 006: Notes field on budget line items
-- Run this in the Supabase SQL editor against an existing REI HQ database
-- that already has migration 005 applied. Adds a free-text notes column so
-- each expense row can carry a short note, matching the owner's expense
-- spreadsheet.

alter table renovation_line_items add column if not exists notes text;
