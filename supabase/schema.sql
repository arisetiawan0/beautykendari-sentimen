create extension if not exists pgcrypto;

create type platform_type as enum ('ig', 'tiktok');
create type sentiment_type as enum ('positive', 'negative', 'neutral');
create type comment_category_type as enum (
  'pertanyaan_produk',
  'komplain',
  'pujian',
  'spam',
  'lainnya'
);
create type alert_status_type as enum ('pending', 'handled');
create type job_status_type as enum ('success', 'failed');

create table posts (
  id uuid primary key default gen_random_uuid(),
  platform platform_type not null,
  platform_post_id text,
  post_url text not null,
  caption text,
  posted_at timestamptz,
  account_name text not null,
  is_active boolean not null default true,
  last_scraped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, post_url),
  unique (platform, platform_post_id)
);

create table raw_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  platform_comment_id text,
  username text not null,
  comment_text text not null,
  cleaned_text text,
  commented_at timestamptz,
  like_count integer,
  scraped_at timestamptz not null default now(),
  is_spam boolean not null default false,
  is_processed boolean not null default false,
  comment_hash text not null unique,
  created_at timestamptz not null default now()
);

create table comments_analyzed (
  id uuid primary key default gen_random_uuid(),
  raw_comment_id uuid not null references raw_comments(id) on delete cascade unique,
  sentiment sentiment_type not null,
  category comment_category_type not null,
  confidence numeric(4, 3) not null check (confidence >= 0 and confidence <= 1),
  summary_reason text,
  model text,
  analyzed_at timestamptz not null default now()
);

create table alerts (
  id uuid primary key default gen_random_uuid(),
  comment_analysis_id uuid not null references comments_analyzed(id) on delete cascade unique,
  status alert_status_type not null default 'pending',
  handled_by text,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

create table job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  status job_status_type not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  details jsonb,
  error_message text
);

create table dashboard_users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  display_name text,
  password_hash text not null,
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dashboard_users_username_not_blank check (length(trim(username)) > 0),
  constraint dashboard_users_password_hash_not_blank check (length(password_hash) > 0)
);

alter table posts enable row level security;
alter table raw_comments enable row level security;
alter table comments_analyzed enable row level security;
alter table alerts enable row level security;
alter table job_runs enable row level security;
alter table dashboard_users enable row level security;

create index posts_platform_active_idx on posts(platform, is_active, posted_at desc);
create index raw_comments_pending_idx on raw_comments(is_processed, is_spam, scraped_at);
create index raw_comments_post_id_idx on raw_comments(post_id);
create index comments_analyzed_sentiment_idx on comments_analyzed(sentiment, analyzed_at desc);
create index alerts_status_idx on alerts(status, created_at desc);
create index job_runs_job_name_idx on job_runs(job_name, started_at desc);
create unique index dashboard_users_username_unique_idx on dashboard_users(lower(username));
create index dashboard_users_active_idx on dashboard_users(is_active, created_at desc);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger posts_set_updated_at
before update on posts
for each row
execute function set_updated_at();

create trigger dashboard_users_set_updated_at
before update on dashboard_users
for each row
execute function set_updated_at();

create or replace function verify_dashboard_user(login_username text, login_password text)
returns table(id uuid, username text, display_name text)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
  update dashboard_users user_row
  set last_login_at = now()
  where lower(user_row.username) = lower(trim(login_username))
    and user_row.is_active = true
    and user_row.password_hash = crypt(login_password, user_row.password_hash)
  returning user_row.id, user_row.username, user_row.display_name;
end;
$$;

revoke execute on function verify_dashboard_user(text, text) from public;
grant execute on function verify_dashboard_user(text, text) to service_role;
