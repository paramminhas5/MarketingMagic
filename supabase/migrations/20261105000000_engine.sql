-- Marketing Magic engine store.
-- Every collection is a table mm_<collection>(id, client, data jsonb, created_at),
-- matching packages/core/src/store.ts. Generated columns expose the fields that
-- Mission Control, the lead-intake function and SQL reports filter on.

create table if not exists mm_clients (
  slug text primary key,
  name text not null,
  playbook text not null,
  profile jsonb not null default '{}',
  machine jsonb,
  created_at timestamptz not null default now()
);

create table if not exists mm_assets (
  id text primary key,
  client text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  product text generated always as (data->>'product') stored,
  kind text generated always as (data->>'kind') stored,
  channel text generated always as (data->>'channel') stored,
  gate_status text generated always as (data->'gate'->>'status') stored,
  approval_status text generated always as (data->'approval'->>'status') stored,
  approval_level text generated always as (data->'approval'->>'level') stored,
  motivation text generated always as (data->'tags'->>'motivation') stored
);
create index if not exists mm_assets_client_idx on mm_assets (client, created_at);
create index if not exists mm_assets_approval_idx on mm_assets (client, approval_status);

create table if not exists mm_leads (
  id text primary key,
  client text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  status text generated always as (data->>'status') stored,
  route text generated always as (data->>'route') stored,
  hdyhau_coded text generated always as (data->>'hdyhauCoded') stored,
  email text generated always as (data->>'email') stored,
  phone text generated always as (data->>'phone') stored
);
create index if not exists mm_leads_client_idx on mm_leads (client, created_at);

create table if not exists mm_metrics (
  id text primary key,
  client text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  date date generated always as ((data->>'date')::date) stored,
  channel text generated always as (data->>'channel') stored,
  entity_id text generated always as (data->>'entityId') stored,
  spend numeric generated always as ((data->>'spend')::numeric) stored,
  results numeric generated always as ((data->>'results')::numeric) stored
);
create index if not exists mm_metrics_client_idx on mm_metrics (client, date);

create table if not exists mm_learnings (
  id text primary key,
  client text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  scope text generated always as (data->>'scope') stored,
  confidence text generated always as (data->>'confidence') stored
);

create table if not exists mm_runs (
  id text primary key,
  client text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  product text generated always as (data->>'product') stored,
  status text generated always as (data->>'status') stored,
  tokens int generated always as (coalesce((data->>'inputTokens')::int, 0) + coalesce((data->>'outputTokens')::int, 0)) stored
);

create table if not exists mm_documents (
  id text primary key,
  client text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  kind text generated always as (data->>'kind') stored
);

-- Lock everything down: only the service role (engine, edge functions) reads/writes.
alter table mm_clients enable row level security;
alter table mm_assets enable row level security;
alter table mm_leads enable row level security;
alter table mm_metrics enable row level security;
alter table mm_learnings enable row level security;
alter table mm_runs enable row level security;
alter table mm_documents enable row level security;

-- Handy views for Mission Control
create or replace view mm_approval_queue as
  select id, client, kind, channel, approval_level, gate_status, data->>'title' as title, created_at
  from mm_assets where approval_status = 'pending' order by created_at;

create or replace view mm_hdyhau_by_client as
  select client, coalesce(hdyhau_coded, 'uncoded') as channel, count(*) as leads
  from mm_leads group by 1, 2;
