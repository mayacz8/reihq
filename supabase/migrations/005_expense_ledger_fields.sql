-- Migration 005: Expense-ledger fields on budget line items
-- Run this in the Supabase SQL editor against an existing REI HQ database
-- that already has migration 004 applied. Adds date/vendor/payment
-- method/paid-by columns to renovation_line_items so real expense-tracking
-- spreadsheets (date, vendor, description, amount, payment method, paid by,
-- notes) can be imported or entered row-by-row, alongside the existing
-- budget-vs-actual category rows and contractor bid workflow.

alter table renovation_line_items add column if not exists expense_date date;
alter table renovation_line_items add column if not exists vendor text;
alter table renovation_line_items add column if not exists payment_method text;
alter table renovation_line_items add column if not exists paid_by text;
