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
