-- Boilerplate: an optional course label on tasks (a class, repo or project name).
-- Paste into the Supabase SQL editor and run once, after 0007_assignment_snapshot_comparison.sql.
-- Safe when the original track/data 0004_task_course.sql was already applied.
--
-- Manual tasks set it through POST/PATCH /api/tasks; null means no label. Team tasks leave it
-- null and are labelled with their team's name at sync time. tasks is owner-only through the
-- tasks_owner_all policy with table-level grants, so the new column needs no grant changes.

alter table public.tasks
  add column if not exists course text
  constraint tasks_course_length check (char_length(course) between 1 and 60);
