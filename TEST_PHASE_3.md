# Phase 3 — Integration Tests

**Status: 🔲 Not started**
**Prerequisite:** Phase 2 complete

---

## Goal

Verify that `loadConfig` / `saveConfig` work correctly against a real database, and —
critically — that the Row Level Security policies actually enforce data isolation between
licensees. This is the HIPAA-relevant layer: an RLS misconfiguration is a data breach,
and that cannot be caught by unit or component tests.

These tests run against the **local Supabase Docker instance** (`supabase start`), never
against the remote production project.

---

## Prerequisites

### 1. Local Supabase must be running

```bash
supabase start   # starts Docker containers for Postgres, Auth, Studio
```

Confirm it's healthy:
```bash
supabase status  # shows URLs and keys
```

### 2. Add service role key to `.env.local`

Integration tests need admin-level access to create and delete test users without going
through the sign-up flow. The service role key bypasses RLS — it is **only safe locally**.

```bash
supabase status  # copy "service_role key" from output
```

Add to `.env.local` (already in `.gitignore`, never commit):
```
SUPABASE_SERVICE_ROLE_KEY=<paste key here>
```

---

## Dependencies to install

No new packages needed — `dotenv` and `@supabase/supabase-js` are already installed.

---

## Files to create

```
tests/
  integration/
    setup.js              ← shared admin client + test user helpers
    supabase.test.js      ← loadConfig / saveConfig round-trips
    rls.test.js           ← RLS isolation (HIPAA-critical)
```

---

## Setup helpers — `tests/integration/setup.js`

```js
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const url     = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const svcKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Admin client — bypasses RLS, used only for fixture setup/teardown
export const adminClient = createClient(url, svcKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Create a test user and return a Supabase client authenticated as that user
export async function createTestSession(email, password) {
  await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  const client = createClient(url, anonKey);
  await client.auth.signInWithPassword({ email, password });
  return client;
}

// Delete a test user by email
export async function cleanupUser(email) {
  const { data } = await adminClient.auth.admin.listUsers();
  const user = data.users.find(u => u.email === email);
  if (user) await adminClient.auth.admin.deleteUser(user.id);
}
```

---

## Test specs

### `supabase.test.js` — I/O layer

Tests `loadConfig` and `saveConfig` from `src/supabase.js` against the live local DB.

| Test | What to assert |
|------|---------------|
| `loadConfig` — unauthenticated | Returns `null` |
| `loadConfig` — no assigned companies | Returns `null` when user exists but has no companies |
| `loadConfig` — has assigned companies | Returns a v2 config blob |
| `loadConfig` — config shape | Returned blob has `version: 2`, `companies` array, each company has `shared` and `serviceLines` |
| `saveConfig` — basic upsert | Returns `true`, company row exists in DB after call |
| `saveConfig` — update | Calling twice with different data overwrites correctly |
| Round-trip | `saveConfig(config)` then `loadConfig()` returns equivalent data |
| `saveConfig` — multi-company | All companies in the config are upserted independently |

### `rls.test.js` — security policies (HIPAA-critical)

Each test creates isolated test users and companies via the admin client, then verifies the
policy from the perspective of an authenticated licensee client.

#### Companies table

| Test | What to assert |
|------|---------------|
| Unauthenticated SELECT | Returns empty array (not an error) |
| Licensee A — assigned company | Can SELECT the company |
| Licensee A — unassigned company | Cannot SELECT a company assigned only to Licensee B |
| Licensee A — editor role | Can UPDATE the company config |
| Licensee A — read_only role | UPDATE returns an error or affects 0 rows |
| Super admin | Can SELECT all companies regardless of licensee assignment |

#### Profiles table

| Test | What to assert |
|------|---------------|
| Own profile | User can SELECT their own row |
| Other user's profile | SELECT returns empty — cannot read another user's row |
| Own profile update | User can UPDATE their own row |

#### Licensees table

| Test | What to assert |
|------|---------------|
| Licensee user SELECT | Returns empty (licensees table is super-admin only) |
| Super admin SELECT | Can read all licensee rows |

---

## Running integration tests

Integration tests run separately from the unit suite so they don't block fast local
development. They require `supabase start` to be running.

```bash
supabase start
npm run test:integration
```

The separate Vitest config (`vitest.integration.config.js`) sets:
- `environment: "node"` (no jsdom needed)
- `testTimeout: 20000` (Supabase local can be slow to respond)
- `hookTimeout: 30000` (user creation / teardown takes time)

---

## CI considerations

Adding integration tests to CI requires the Supabase Docker image. Use the official
GitHub Action:

```yaml
  integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - run: supabase start
      - run: npm run test:integration
        env:
          VITE_SUPABASE_URL: http://localhost:54321
          VITE_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_LOCAL_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_LOCAL_SERVICE_ROLE_KEY }}
```

Docker image pull adds ~90s to pipeline startup. Run integration tests on push to `main`
only (not on every PR) to keep PR feedback fast.

---

## Known risks

**`licensee_id` on profiles — TODO in schema**
The current RLS policy joins `licensees.name = profiles.email` as a temporary measure
(see comment in `20260508174403_initial_schema.sql`). The integration tests should verify
the policy as it exists today, and a separate test should be added when the `licensee_id`
FK is added to `profiles`. Track this in schema migration work.

**Test data isolation**
Each test file must create and destroy its own test users and companies. The `beforeAll` /
`afterAll` hooks in `setup.js` handle this. Do not rely on seed data — seed data is
for the dev server, not for tests.

---

## Acceptance criteria

- [ ] `tests/integration/setup.js` written with admin client and helpers
- [ ] `supabase.test.js` — all round-trip tests passing
- [ ] `rls.test.js` — all 10 isolation tests passing
- [ ] Tests clean up after themselves (no leftover users/companies in local DB)
- [ ] `npm run test:integration` documented in README
- [ ] CI integration job added to `.github/workflows/test.yml`
