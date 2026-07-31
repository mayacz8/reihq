-- Migration 003: Project schedule (Gantt chart)
-- Run this in the Supabase SQL editor against an existing REI HQ database
-- that already has migration 002 applied. Adds task categories (for
-- grouping the Gantt chart) and task dependencies (for blocking/ordering).

-- 1. Tag tasks with a category so they can be grouped on the schedule view
-- (e.g. Kitchen, Roof, Permits) - independent of which contractor is doing it.
alter table renovation_tasks add column if not exists category text not null default 'General';

-- 2. Task dependencies: task_id can't start until depends_on_task_id is done.
-- A task can depend on more than one predecessor.
create table if not exists task_dependencies (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references renovation_tasks(id) on delete cascade,
  depends_on_task_id uuid not null references renovation_tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (task_id <> depends_on_task_id),
  unique (task_id, depends_on_task_id)
);

alter table task_dependencies enable row level security;
drop policy if exists "task_dependencies_owner_all" on task_dependencies;
create policy "task_dependencies_owner_all" on task_dependencies for all using (current_role_is_owner());
drop policy if exists "task_dependencies_scoped" on task_dependencies;
create policy "task_dependencies_scoped" on task_dependencies for all using (
  exists (
    select 1 from renovation_tasks t
    join renovation_projects rp on rp.id = t.project_id
    where t.id = task_dependencies.task_id
      and has_property_scope(rp.property_id, array['renovation'])
  )
);
