-- Migration 004: Distinguish punch list tasks from construction schedule items
-- Run this in the Supabase SQL editor against an existing REI HQ database
-- that already has migration 003 applied. Adds item_type to renovation_tasks
-- so the punch list and the project schedule can have separate inputs, and
-- so the Gantt chart can color-code the two kinds of item differently.

alter table renovation_tasks add column if not exists item_type text not null default 'task';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'renovation_tasks_item_type_check'
  ) then
    alter table renovation_tasks add constraint renovation_tasks_item_type_check
      check (item_type in ('task', 'schedule_item'));
  end if;
end $$;
