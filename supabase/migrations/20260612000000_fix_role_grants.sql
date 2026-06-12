-- Fix role grants exposed by Supabase CLI breaking change (post-Jun-10 release).
--
-- service_role has BYPASSRLS but is not a PostgreSQL superuser — it needs
-- explicit table grants just like other roles. Earlier CLI versions granted
-- this implicitly; the current version does not.
--
-- anon needs SELECT on tables that the API exposes so unauthenticated
-- requests return empty sets (RLS blocks the rows) instead of 42501 errors.
--
-- authenticated was missing UPDATE on profiles; the RLS own-row policy
-- already exists but was unreachable without the table-level grant.

grant select, insert, update, delete on public.profiles          to service_role;
grant select, insert, update, delete on public.companies         to service_role;
grant select, insert, update, delete on public.licensees         to service_role;
grant select, insert, update, delete on public.licensee_companies to service_role;

-- anon: SELECT-only; RLS returns empty rows for non-matching unauthenticated requests
grant select on public.companies to anon;

-- authenticated: UPDATE on profiles (own-row RLS policy already in place)
grant update on public.profiles to authenticated;
