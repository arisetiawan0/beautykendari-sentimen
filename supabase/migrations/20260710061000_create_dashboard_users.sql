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

create unique index dashboard_users_username_unique_idx on dashboard_users(lower(username));
create index dashboard_users_active_idx on dashboard_users(is_active, created_at desc);

alter table dashboard_users enable row level security;

create trigger dashboard_users_set_updated_at
before update on dashboard_users
for each row
execute function set_updated_at();

create or replace function verify_dashboard_user(login_username text, login_password text)
returns table(id uuid, username text, display_name text)
language plpgsql
security definer
set search_path = public
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
