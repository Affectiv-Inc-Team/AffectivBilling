-- anon needs SELECT on profiles so that the companies RLS subquery
-- (exists(select 1 from profiles where id = auth.uid() ...)) can evaluate
-- without a 42501 error. auth.uid() returns null for unauthenticated
-- requests so the own-row RLS policy on profiles still returns no rows.
grant select on public.profiles to anon;
