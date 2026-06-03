# AffectivBilling
A scalable billing platform designed to support Medicaid service providers, streamlining claims, tracking, and compliance for individuals with disabilities, with plans for full integration into a broader SaaS solution.

## Testing

Unit + component tests (no external dependencies):

```bash
npm test                # run all unit/component tests once
npm run test:watch      # watch mode
npm run test:coverage   # with coverage report
```

Integration tests exercise the persistence + RLS layer against a **local**
Supabase Docker instance (never production — `tests/integration/setup.js` aborts
if the resolved URL is not `127.0.0.1`):

```bash
supabase start          # boot local Postgres/Auth (requires Docker running)
supabase db reset       # apply migrations + seed to a clean DB
npm run test:integration
```

See [docs/TEST_STATUS.md](docs/TEST_STATUS.md) for the full test-suite roadmap.
