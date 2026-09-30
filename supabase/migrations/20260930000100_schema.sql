-- Endorse Commons: core schema (SPEC §12, §13b)

create extension if not exists vector with schema extensions;
create extension if not exists citext with schema extensions;
create extension if not exists pg_cron;

set search_path = public, extensions;

-- enums ---------------------------------------------------------------------
create type paper_status as enum ('draft','open','in_review','endorsed','posted','withdrawn','expired');
create type paper_type as enum ('original_research','survey_review','position','other');
create type engagement_state as enum ('accepted','waitlisted','reviewing','endorsed_pending_author',
  'endorsed','declined','withdrawn_by_endorser','released_by_author','closed_endorsed_elsewhere','expired');
create type waitlist_reason as enum ('paper_full','endorser_full');
create type capability_status as enum ('claimed','confirmed','suspended');
create type member_role as enum ('owner','coauthor');
create type app_role as enum ('user','moderator');
create type pledge_status as enum ('pending','reminded','fulfilled','declined');

-- reference data ------------------------------------------------------------
create table categories (
  code text primary key,
  archive text not null,
  name text not null,
  description text,
  active boolean not null default true
);

create table topics (
  id bigint generated always as identity primary key,
  category_code text not null references categories(code),
  slug text not null,
  name text not null,
  unique (category_code, slug)
);

-- people --------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle extensions.citext unique not null check (handle ~ '^[a-z0-9_]{3,30}$'),
  display_name text not null check (char_length(display_name) between 2 and 80),
  headline text check (char_length(headline) <= 140),
  bio text check (char_length(bio) <= 600),
  avatar_path text,
  linkedin_url text not null
    check (linkedin_url ~ '^https://(www\.)?linkedin\.com/in/[A-Za-z0-9\-_%]+/?$'),
  google_scholar_url text check (google_scholar_url is null or google_scholar_url ~ '^https://scholar\.google\.[a-z.]+/'),
  orcid text check (orcid is null or orcid ~ '^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$'),
  openalex_author_id text check (openalex_author_id is null or openalex_author_id ~ '^A\d+$'),
  github_username text,
  hf_username text check (hf_username is null or hf_username ~ '^[A-Za-z0-9][A-Za-z0-9_.\-]{0,95}$'),
  homepage_url text check (homepage_url is null or homepage_url ~ '^https?://'),
  role app_role not null default 'user',
  karma integer not null default 0,
  public_availability boolean not null default false,
  age_attested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table profile_interests (
  user_id uuid references profiles(id) on delete cascade,
  topic_id bigint references topics(id),
  primary key (user_id, topic_id)
);

-- categories a user cares about even when no sub-topic is curated for it
create table profile_categories (
  user_id uuid references profiles(id) on delete cascade,
  category_code text references categories(code),
  primary key (user_id, category_code)
);

create table profile_publications (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  source text not null default 'openalex',
  external_id text not null,
  title text not null,
  venue text,
  year int,
  url text,
  arxiv_id text,
  coauthor_names text[],
  fetched_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);

create table endorser_capabilities (
  user_id uuid references profiles(id) on delete cascade,
  category_code text references categories(code),
  status capability_status not null default 'claimed',
  evidence_url text not null check (evidence_url ~ '^https://arxiv\.org/auth/show-endorsers/'),
  attested_at timestamptz not null default now(),
  confirmed_at timestamptz,
  max_active_reviews int not null default 3 check (max_active_reviews between 1 and 10),
  accepting boolean not null default true,
  paused_until timestamptz,
  primary key (user_id, category_code)
);

-- papers --------------------------------------------------------------------
create table papers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id),
  title text not null check (char_length(title) between 10 and 300),
  abstract text not null check (char_length(abstract) between 200 and 2500),
  primary_category text not null references categories(code),
  cross_list_categories text[] not null default '{}',
  paper_type paper_type not null,
  peer_review_proof_url text,
  repo_url text check (repo_url is null or repo_url ~ '^https?://'),
  status paper_status not null default 'draft',
  own_work_attested_at timestamptz not null,
  posted_at timestamptz,
  endorsed_at timestamptz,
  arxiv_id text,
  arxiv_verified_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cs_survey_needs_proof check (
    not (primary_category like 'cs.%' and paper_type in ('survey_review','position')
         and peer_review_proof_url is null)),
  constraint cross_list_max check (cardinality(cross_list_categories) <= 5)
);
create index papers_owner_idx on papers(owner_id, status);
create index papers_status_idx on papers(status, primary_category, posted_at desc);

create table paper_members (
  paper_id uuid references papers(id) on delete cascade,
  user_id uuid references profiles(id),
  role member_role not null,
  primary key (paper_id, user_id)
);
create index paper_members_user_idx on paper_members(user_id);

create table paper_topics (
  paper_id uuid references papers(id) on delete cascade,
  topic_id bigint references topics(id),
  primary key (paper_id, topic_id)
);

create table paper_versions (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references papers(id) on delete cascade,
  version_no int not null,
  storage_path text,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  size_bytes int not null check (size_bytes > 0 and size_bytes <= 20*1024*1024),
  note text check (char_length(note) <= 500),
  uploaded_by uuid not null references profiles(id),
  uploaded_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (paper_id, version_no)
);

create table paper_secrets (
  paper_id uuid primary key references papers(id) on delete cascade,
  endorsement_code text not null check (endorsement_code ~ '^[A-Z0-9]{6}$'),
  category_code text not null references categories(code),
  set_at timestamptz not null default now()
);
create unique index uniq_open_code on paper_secrets(endorsement_code);

create table engagements (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references papers(id) on delete cascade,
  endorser_id uuid not null references profiles(id),
  state engagement_state not null default 'accepted',
  waitlist_reason waitlist_reason,
  waitlisted_at timestamptz,
  accepted_at timestamptz not null default now(),
  shared_at timestamptz,
  reviewing_since timestamptz,
  paper_opened_at timestamptz,
  paper_opened_version uuid references paper_versions(id) on delete set null,
  linkedin_checked_at timestamptz,
  feedback_rounds int not null default 0,
  last_activity_at timestamptz not null default now(),
  decided_at timestamptz,
  decline_reason text check (char_length(decline_reason) <= 2000),
  closed_at timestamptz,
  expiry_warned_at timestamptz,
  unique (paper_id, endorser_id)
);
create index eng_state_idx on engagements(state, last_activity_at);
create index eng_endorser_idx on engagements(endorser_id, state);
create index eng_paper_idx on engagements(paper_id, state);

-- endorsers who passed on an abstract (hidden from their feed)
create table abstract_passes (
  paper_id uuid references papers(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (paper_id, user_id)
);

create table feedback_messages (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references engagements(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  round int not null,
  body text not null check (char_length(body) between 1 and 8000),
  paper_version_id uuid references paper_versions(id) on delete set null,
  created_at timestamptz not null default now()
);
create index feedback_eng_idx on feedback_messages(engagement_id, created_at);

create table feedback_ratings (
  engagement_id uuid primary key references engagements(id) on delete cascade,
  rated_by uuid not null references profiles(id),
  helpful boolean not null,
  comment text check (char_length(comment) <= 1000),
  created_at timestamptz not null default now()
);

create table endorsements (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid unique not null references engagements(id),
  paper_id uuid unique not null references papers(id),
  endorser_id uuid not null references profiles(id),
  category_code text not null references categories(code),
  reviewer_confirmed_at timestamptz not null default now(),
  author_confirmed_at timestamptz,
  arxiv_verified_at timestamptz,
  removed_flag boolean not null default false
);

create table nudges (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references papers(id) on delete cascade,
  endorser_id uuid not null references profiles(id),
  sent_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (paper_id, endorser_id)
);

-- notifications (in-app only) -----------------------------------------------
create table notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notif_user_idx on notifications(user_id, read_at, created_at desc);

-- karma ---------------------------------------------------------------------
create table karma_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id),
  kind text not null,
  points int not null,
  engagement_id uuid references engagements(id),
  created_at timestamptz not null default now(),
  unique (user_id, kind, engagement_id)
);
create index karma_user_idx on karma_events(user_id, created_at);

create table badges (
  user_id uuid references profiles(id) on delete cascade,
  badge text not null,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge)
);

-- matching ------------------------------------------------------------------
create table paper_embeddings (
  paper_id uuid primary key references papers(id) on delete cascade,
  embedding extensions.vector(384) not null,
  updated_at timestamptz not null default now()
);
create table endorser_embeddings (
  user_id uuid primary key references profiles(id) on delete cascade,
  embedding extensions.vector(384) not null,
  updated_at timestamptz not null default now()
);
create table embedding_jobs (
  id bigint generated always as identity primary key,
  target_type text not null check (target_type in ('paper','endorser')),
  target_id uuid not null,
  status text not null default 'queued' check (status in ('queued','done','failed','skipped')),
  attempts int not null default 0,
  created_at timestamptz default now()
);
create unique index embedding_jobs_queued_uniq on embedding_jobs(target_type, target_id) where status = 'queued';

-- trust & ops ---------------------------------------------------------------
create table moderation_flags (
  id bigint generated always as identity primary key,
  kind text not null,
  subject_user uuid references profiles(id),
  paper_id uuid references papers(id),
  detail jsonb,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null references profiles(id),
  target_type text not null check (target_type in ('profile','paper','message')),
  target_id text not null,
  reason text not null check (char_length(reason) between 3 and 2000),
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table share_clicks (
  id bigint generated always as identity primary key,
  user_id uuid references profiles(id),
  network text not null check (network in ('linkedin','x','copy_linkedin','copy_x')),
  surface text not null check (char_length(surface) <= 60),
  created_at timestamptz not null default now()
);

create table platform_config (key text primary key, value jsonb not null);

create table audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  detail jsonb,
  at timestamptz not null default now()
);

create table ai_screens (
  paper_version_id uuid primary key references paper_versions(id),
  result jsonb,
  created_at timestamptz default now()
);

-- trust features (§13b) -----------------------------------------------------
create table readiness_checks (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references papers(id) on delete cascade,
  answers jsonb not null,
  passed boolean not null,
  failed_items text[] not null default '{}',
  checked_at timestamptz not null default now()
);
create index readiness_paper_idx on readiness_checks(paper_id, checked_at desc);

create table pledges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  source_paper_id uuid references papers(id),
  category_code text not null references categories(code),
  topic_ids bigint[] not null default '{}',
  status pledge_status not null default 'pending',
  remind_on date,
  reminded_at timestamptz,
  fulfilled_engagement_id uuid references engagements(id),
  created_at timestamptz not null default now(),
  unique (user_id, category_code)
);

-- config defaults (§5) -------------------------------------------------------
insert into platform_config (key, value) values
  ('max_active_reviewers_per_paper', '3'),
  ('default_endorser_max_active_reviews', '3'),
  ('max_open_papers_per_author', '2'),
  ('accept_ttl_days', '7'),
  ('review_ttl_days', '10'),
  ('reminder_before_expiry_days', '3'),
  ('retention_days_after_close', '30'),
  ('smart_match_min_papers', '50'),
  ('smart_match_min_endorsers', '30'),
  ('max_nudges_per_paper_per_week', '3'),
  ('max_pdf_bytes', '10485760'),
  ('min_age', '16'),
  ('ai_screening_enabled', 'false');
