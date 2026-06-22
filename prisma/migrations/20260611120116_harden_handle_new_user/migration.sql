-- handle_new_user() is a SECURITY DEFINER trigger function in the public schema,
-- so Postgres' default EXECUTE-to-PUBLIC grant exposed it as a callable RPC at
-- /rest/v1/rpc/handle_new_user for the anon and authenticated roles. It is only
-- ever meant to fire from the on_auth_user_created trigger, so revoke EXECUTE.
--
-- This does NOT disable the trigger: trigger execution is governed by the table's
-- TRIGGER privilege, not by EXECUTE grants on the function. Signups still auto-create
-- profiles; only the public RPC endpoint is removed.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
