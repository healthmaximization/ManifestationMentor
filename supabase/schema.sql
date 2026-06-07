create extension if not exists "pgcrypto";

-- Shared identity and monetization layer for all tools under the same company.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  company_role text not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  key text primary key,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_key text not null references public.products(key) on delete restrict,
  plan_key text not null,
  source text not null default 'stripe',
  status text not null check (status in ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'manual')),
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_key, source)
);

create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_key text not null references public.products(key) on delete cascade,
  access_level text not null default 'standard',
  source text not null default 'subscription',
  active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_key, source)
);

-- Manifestation Advisor app.
create table if not exists public.manifestation_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New manifestation chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.manifestation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.manifestation_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.manifestation_training_config (
  id text primary key default 'main',
  tone text not null default 'warm & empathetic',
  response_length text not null default 'medium',
  personality_traits text[] not null default array['supportive', 'action-oriented'],
  custom_instructions text not null default '',
  methodology text not null default 'hybrid',
  banned_phrases text[] not null default array[]::text[],
  qa_pairs jsonb not null default '[]'::jsonb,
  system_prompt text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.manifestation_training_documents (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  file_size bigint not null,
  mime_type text not null,
  storage_path text not null,
  extracted_text text,
  status text not null default 'processing' check (status in ('processing', 'indexed', 'ready', 'error')),
  created_at timestamptz not null default now()
);

-- Reserved Subliminal Maker app tables. The other project can extend these
-- instead of inventing a conflicting subscription/auth structure.
create table if not exists public.subliminal_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled subliminal',
  intention text,
  status text not null default 'draft' check (status in ('draft', 'generating', 'ready', 'archived', 'error')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subliminal_projects
add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.subliminal_scripts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.subliminal_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  script_text text not null,
  voice_style text,
  created_at timestamptz not null default now()
);

create table if not exists public.subliminal_audio_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.subliminal_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'processing', 'ready', 'error')),
  storage_path text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subliminal_exports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.subliminal_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  format text not null default 'mp3',
  created_at timestamptz not null default now()
);

create table if not exists public.subliminal_generation_config (
  id text primary key default 'main',
  prompt text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.subscriptions enable row level security;
alter table public.entitlements enable row level security;
alter table public.manifestation_conversations enable row level security;
alter table public.manifestation_messages enable row level security;
alter table public.manifestation_training_config enable row level security;
alter table public.manifestation_training_documents enable row level security;
alter table public.subliminal_projects enable row level security;
alter table public.subliminal_scripts enable row level security;
alter table public.subliminal_audio_jobs enable row level security;
alter table public.subliminal_exports enable row level security;
alter table public.subliminal_generation_config enable row level security;

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile"
on public.profiles for select
using (auth.uid() = id);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
on public.profiles for update
using (auth.uid() = id);

drop policy if exists "Users read active products" on public.products;
create policy "Users read active products"
on public.products for select
using (active = true);

drop policy if exists "Users read own subscriptions" on public.subscriptions;
create policy "Users read own subscriptions"
on public.subscriptions for select
using (auth.uid() = user_id);

drop policy if exists "Users read own entitlements" on public.entitlements;
create policy "Users read own entitlements"
on public.entitlements for select
using (auth.uid() = user_id);

drop policy if exists "Users read own manifestation conversations" on public.manifestation_conversations;
create policy "Users read own manifestation conversations"
on public.manifestation_conversations for select
using (auth.uid() = user_id);

drop policy if exists "Users create own manifestation conversations" on public.manifestation_conversations;
create policy "Users create own manifestation conversations"
on public.manifestation_conversations for insert
with check (auth.uid() = user_id);

drop policy if exists "Users update own manifestation conversations" on public.manifestation_conversations;
create policy "Users update own manifestation conversations"
on public.manifestation_conversations for update
using (auth.uid() = user_id);

drop policy if exists "Users read own manifestation messages" on public.manifestation_messages;
create policy "Users read own manifestation messages"
on public.manifestation_messages for select
using (auth.uid() = user_id);

drop policy if exists "Users create own manifestation messages" on public.manifestation_messages;
create policy "Users create own manifestation messages"
on public.manifestation_messages for insert
with check (auth.uid() = user_id);

drop policy if exists "Users read own subliminal projects" on public.subliminal_projects;
create policy "Users read own subliminal projects"
on public.subliminal_projects for select
using (auth.uid() = user_id);

drop policy if exists "Users create own subliminal projects" on public.subliminal_projects;
create policy "Users create own subliminal projects"
on public.subliminal_projects for insert
with check (auth.uid() = user_id);

drop policy if exists "Users update own subliminal projects" on public.subliminal_projects;
create policy "Users update own subliminal projects"
on public.subliminal_projects for update
using (auth.uid() = user_id);

drop policy if exists "Users read own subliminal scripts" on public.subliminal_scripts;
create policy "Users read own subliminal scripts"
on public.subliminal_scripts for select
using (auth.uid() = user_id);

drop policy if exists "Users create own subliminal scripts" on public.subliminal_scripts;
create policy "Users create own subliminal scripts"
on public.subliminal_scripts for insert
with check (auth.uid() = user_id);

drop policy if exists "Users read own subliminal audio jobs" on public.subliminal_audio_jobs;
create policy "Users read own subliminal audio jobs"
on public.subliminal_audio_jobs for select
using (auth.uid() = user_id);

drop policy if exists "Users create own subliminal audio jobs" on public.subliminal_audio_jobs;
create policy "Users create own subliminal audio jobs"
on public.subliminal_audio_jobs for insert
with check (auth.uid() = user_id);

drop policy if exists "Users read own subliminal exports" on public.subliminal_exports;
create policy "Users read own subliminal exports"
on public.subliminal_exports for select
using (auth.uid() = user_id);

create index if not exists subscriptions_user_product_idx on public.subscriptions(user_id, product_key, status);
create index if not exists entitlements_user_product_idx on public.entitlements(user_id, product_key, active);
create index if not exists manifestation_conversations_user_updated_idx on public.manifestation_conversations(user_id, updated_at desc);
create index if not exists manifestation_messages_conversation_created_idx on public.manifestation_messages(conversation_id, created_at);
create index if not exists subliminal_projects_user_updated_idx on public.subliminal_projects(user_id, updated_at desc);
create index if not exists subliminal_audio_jobs_project_idx on public.subliminal_audio_jobs(project_id, status);

insert into public.products (key, name, description)
values
  ('manifestation_advisor', 'Manifestation Advisor', 'AI manifestation coaching and owner-trained knowledge base.'),
  ('subliminal_maker', 'Subliminal Maker', 'Subliminal script, audio, and export creation tool.'),
  ('pro_bundle', 'Pro Bundle', 'Access to Manifestation Advisor and Subliminal Maker.')
on conflict (key) do update
set name = excluded.name,
    description = excluded.description,
    active = true;

insert into public.manifestation_training_config (id, system_prompt)
values (
  'main',
  'You are an AI manifestation advisor. You combine manifestation principles with practical psychology and peak performance coaching. Help users clarify goals, identify limiting beliefs, choose aligned actions, and stay emotionally regulated. Do not promise guaranteed outcomes.'
)
on conflict (id) do nothing;

insert into public.subliminal_generation_config (id, prompt)
values (
  'main',
  'You are an expert subliminal affirmation writer. Generate first-person affirmations that are positive, present-tense, emotionally believable, direct, safe, and suitable for looping in a subliminal audio track. Return only the affirmations, one per line.'
)
on conflict (id) do nothing;
