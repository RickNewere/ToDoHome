-- ToDoHome - database schema
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor > New query).
-- Safe to re-run: everything is idempotent.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- A chore definition: what it is and how often it must be repeated.
create table if not exists public.chores (
  id           uuid primary key default gen_random_uuid(),
  name         text        not null unique,
  emoji        text        not null default '🏠',
  category     text        not null default 'Casa',
  -- How many days must pass between two completions.
  cadence_days integer     not null check (cadence_days > 0),
  -- When true the chore can only fall on Saturday or Sunday: the computed due
  -- date is pushed forward to the next Saturday if it lands on a weekday.
  weekend_only boolean     not null default false,
  note         text,
  sort_order   integer     not null default 0,
  active       boolean     not null default true,
  created_at   timestamptz not null default now()
);

-- Chores pinned to a calendar date rather than to a cadence, like swapping the
-- wardrobe on the 30th of May. scheduled_on holds that date; yearly says
-- whether it comes back on the same day every year or happens only once.
alter table public.chores add column if not exists scheduled_on date;
alter table public.chores add column if not exists yearly boolean not null default false;

-- The anniversary of p_anchor that first falls after p_after. Adding an
-- interval rather than rebuilding the date keeps 29 February from failing:
-- Postgres pulls it back to the 28th in ordinary years.
create or replace function public.next_yearly(p_anchor date, p_after date)
returns date
language sql
immutable
as $$
  select d
  from (
    select (p_anchor + (k || ' years')::interval)::date as d
    from generate_series(
      greatest(0, date_part('year', p_after)::int - date_part('year', p_anchor)::int),
      greatest(0, date_part('year', p_after)::int - date_part('year', p_anchor)::int) + 1
    ) as k
  ) candidates
  where d > p_after
  order by d
  limit 1
$$;

-- One "run" is one pending cycle of a chore. A chore counts as done only when
-- both Riccardo and Roberta have ticked it, which is when completed_at is set.
create table if not exists public.chore_runs (
  id           uuid primary key default gen_random_uuid(),
  chore_id     uuid        not null references public.chores(id) on delete cascade,
  riccardo_at  timestamptz,
  roberta_at   timestamptz,
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists chore_runs_chore_idx
  on public.chore_runs (chore_id, completed_at desc);

-- At most one open run per chore. This is what makes concurrent ticks from two
-- phones converge on the same row instead of creating duplicates.
create unique index if not exists chore_runs_one_open_per_chore
  on public.chore_runs (chore_id)
  where completed_at is null;

-- ---------------------------------------------------------------------------
-- Status view: due date and lateness computed server side, so the web app and
-- the Android widget can never disagree about what is late.
-- ---------------------------------------------------------------------------

create or replace view public.chore_status
with (security_invoker = true) as
select
  c.id,
  c.name,
  c.emoji,
  c.category,
  c.cadence_days,
  c.weekend_only,
  c.note,
  c.sort_order,
  lastrun.completed_at as last_completed_at,
  openrun.id           as open_run_id,
  openrun.riccardo_at,
  openrun.roberta_at,
  due.due_date,
  (today.d - due.due_date)::integer as days_late,
  -- Appended at the end on purpose: create or replace view only accepts new
  -- columns after the existing ones.
  c.scheduled_on,
  c.yearly
from public.chores c
cross join lateral (
  select (now() at time zone 'Europe/Rome')::date as d
) today
left join lateral (
  select r.completed_at
  from public.chore_runs r
  where r.chore_id = c.id
    and r.completed_at is not null
  order by r.completed_at desc
  limit 1
) lastrun on true
left join lateral (
  select r.id, r.riccardo_at, r.roberta_at
  from public.chore_runs r
  where r.chore_id = c.id
    and r.completed_at is null
  order by r.created_at
  limit 1
) openrun on true
cross join lateral (
  select case
           -- A chosen date is exact: shifting it to the weekend would defeat
           -- the point of choosing it.
           when c.scheduled_on is not null then raw.d
           -- extract(dow) -> 0 Sunday .. 6 Saturday. Weekday lands get pushed
           -- forward to the upcoming Saturday.
           when c.weekend_only and extract(dow from raw.d) between 1 and 5
             then raw.d + (6 - extract(dow from raw.d))::integer
           else raw.d
         end as due_date
  from (
    select case
             when c.scheduled_on is not null then
               case
                 when lastrun.completed_at is null then c.scheduled_on
                 when c.yearly then public.next_yearly(
                        c.scheduled_on,
                        (lastrun.completed_at at time zone 'Europe/Rome')::date
                      )
                 -- Done once and never again. A far date parks it among the
                 -- finished ones, where it can still be undone; the app shows
                 -- "non torna piu" instead of this placeholder.
                 else date '9999-12-31'
               end
             else coalesce(
                    ((lastrun.completed_at at time zone 'Europe/Rome')::date + c.cadence_days),
                    today.d
                  )
           end as d
  ) raw
) due
where c.active;

-- ---------------------------------------------------------------------------
-- RPC: toggle one person's tick on a chore.
-- Creates the open run if missing, closes it when both have ticked, and drops
-- it again if it ends up empty. All in one statement so the widget needs a
-- single HTTP call.
-- ---------------------------------------------------------------------------

create or replace function public.toggle_check(p_chore_id uuid, p_user text)
returns public.chore_runs
language plpgsql
as $$
declare
  v_run public.chore_runs;
begin
  if p_user not in ('riccardo', 'roberta') then
    raise exception 'utente non valido: %', p_user;
  end if;

  select * into v_run
  from public.chore_runs
  where chore_id = p_chore_id and completed_at is null
  order by created_at
  limit 1;

  -- Both phones can find no open run and insert at the same instant. The partial
  -- unique index catches that, and on conflict lets the loser re-read the row
  -- the winner created instead of failing the whole call.
  if v_run.id is null then
    insert into public.chore_runs (chore_id)
    values (p_chore_id)
    on conflict do nothing
    returning * into v_run;

    if v_run.id is null then
      select * into v_run
      from public.chore_runs
      where chore_id = p_chore_id and completed_at is null
      order by created_at
      limit 1;
    end if;

    if v_run.id is null then
      raise exception 'non riesco ad aprire un giro per questa faccenda';
    end if;
  end if;

  if p_user = 'riccardo' then
    update public.chore_runs
       set riccardo_at = case when riccardo_at is null then now() else null end
     where id = v_run.id
     returning * into v_run;
  else
    update public.chore_runs
       set roberta_at = case when roberta_at is null then now() else null end
     where id = v_run.id
     returning * into v_run;
  end if;

  -- Both ticked: the cycle is closed and the next due date starts counting.
  if v_run.riccardo_at is not null and v_run.roberta_at is not null then
    update public.chore_runs
       set completed_at = now()
     where id = v_run.id
     returning * into v_run;

  -- Nobody left on the run: remove it so the chore goes back to a clean state.
  elsif v_run.riccardo_at is null and v_run.roberta_at is null then
    delete from public.chore_runs where id = v_run.id;
    v_run.id := null;
  end if;

  return v_run;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: undo the last completion of a chore (ticked by mistake).
-- Reopens the most recent closed run, unless one is already open.
-- ---------------------------------------------------------------------------

create or replace function public.reopen_last(p_chore_id uuid)
returns public.chore_runs
language plpgsql
as $$
declare
  v_run public.chore_runs;
begin
  if exists (
    select 1 from public.chore_runs
    where chore_id = p_chore_id and completed_at is null
  ) then
    raise exception 'esiste gia un giro aperto per questa faccenda';
  end if;

  select * into v_run
  from public.chore_runs
  where chore_id = p_chore_id and completed_at is not null
  order by completed_at desc
  limit 1;

  if v_run.id is null then
    raise exception 'nessun completamento da annullare';
  end if;

  update public.chore_runs
     set completed_at = null
   where id = v_run.id
   returning * into v_run;

  return v_run;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row level security
--
-- This is a two person household app published on a public URL, so the anon
-- key is visible in the client bundle. Access is deliberately open to the anon
-- role: there is no login and no personal data beyond chore names. If you ever
-- want it locked down, replace these policies with auth.uid() based ones and
-- add Supabase Auth to the web app.
-- ---------------------------------------------------------------------------

alter table public.chores     enable row level security;
alter table public.chore_runs enable row level security;

drop policy if exists chores_anon_all     on public.chores;
drop policy if exists chore_runs_anon_all on public.chore_runs;

create policy chores_anon_all on public.chores
  for all to anon, authenticated using (true) with check (true);

create policy chore_runs_anon_all on public.chore_runs
  for all to anon, authenticated using (true) with check (true);

grant select on public.chore_status to anon, authenticated;
grant execute on function public.toggle_check(uuid, text) to anon, authenticated;
grant execute on function public.reopen_last(uuid)        to anon, authenticated;

-- Realtime: pushes changes to the other phone without a refresh.
-- Wrapped so that re-running this file does not fail on "already member".
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chore_runs'
  ) then
    alter publication supabase_realtime add table public.chore_runs;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chores'
  ) then
    alter publication supabase_realtime add table public.chores;
  end if;
end $$;
