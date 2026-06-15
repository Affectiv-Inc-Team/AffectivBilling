-- anon needs SELECT on profiles, licensee_companies, and licensees so that
-- the companies RLS subqueries can evaluate without 42501 errors. Three
-- policies on companies join these tables to determine row visibility:
--   "super admin full access"  -> profiles
--   "licensee read access"     -> licensee_companies, licensees, profiles
--   "licensee editor write"    -> licensee_companies, licensees, profiles
--
-- auth.uid() returns null for unauthenticated requests so every exists()
-- subquery resolves to false and no rows are returned. The grants here
-- allow Postgres to evaluate the policies; RLS on each referenced table
-- still prevents anon from reading any actual rows in those tables.
grant select on public.profiles           to anon;
grant select on public.licensee_companies to anon;
grant select on public.licensees          to anon;
