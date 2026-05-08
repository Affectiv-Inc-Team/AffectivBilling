-- Grant table access to the authenticated role.
-- RLS policies control row visibility; these grants enable table access at all.

grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.companies to authenticated;
grant select, insert, update, delete on public.licensees to authenticated;
grant select, insert, update, delete on public.licensee_companies to authenticated;
