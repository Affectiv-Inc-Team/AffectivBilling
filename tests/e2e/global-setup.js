// Provisions the E2E identity before any spec runs, and resets the seed
// company so each run starts from a known baseline.
//
// Uses the Supabase service_role key (bypasses RLS, can manage auth users),
// injected by the `test:e2e` npm script from `supabase status`. Mirrors the
// safety model of tests/integration/setup.js: refuses any non-local URL.

import WS from 'ws';
import { createClient } from '@supabase/supabase-js';
import { E2E_EMAIL, E2E_PASSWORD, LOCAL_SUPABASE_URL } from './fixtures/credentials.js';

// supabase-js spins up a Realtime client needing a global WebSocket; Node < 22
// (CI's Node 20) lacks one. No-op on Node 22+.
if (!globalThis.WebSocket) globalThis.WebSocket = WS;

// Baseline config the seed company is reset to before every run — mirrors
// supabase/seed.sql so tests never inherit drift from a prior run.
const SEED_COMPANY_ID = 'co_default1';
const SEED_CONFIG = {
  shared: {
    wage: 16, graveyardWage: 9.5, occupancy: 95,
    entityType: 'ccorp', ownerRate: 32, mgmtFeePct: 5, billingFeePct: 1,
    rates: { intenseDaily: 678.77, highDaily: 368.67, iuUnit: 7.07, igUnit: 3.61 },
    mgmt: [], overhead: [],
    sharedOverhead: { fixedAnnual: 0, perHomePerMonth: 0, perParticipantPerMonth: 0, perCoordinatorPerMonth: 0 },
    allocationMethod: 'revenue',
  },
  serviceLines: [],
};

export default async function globalSetup() {
  const url = process.env.VITE_SUPABASE_URL || LOCAL_SUPABASE_URL;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url !== LOCAL_SUPABASE_URL && url !== 'http://localhost:54321') {
    throw new Error(
      `E2E global-setup refuses to run against a non-local Supabase URL.\n` +
        `  Resolved: ${url}\n` +
        `  Start local Supabase with \`supabase start\` and run \`npm run test:e2e\`.`,
    );
  }
  if (!svcKey) {
    throw new Error(
      'E2E tests need SUPABASE_SERVICE_ROLE_KEY (injected by the test:e2e npm ' +
        'script from `supabase status`). Is local Supabase running?',
    );
  }

  const admin = createClient(url, svcKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Idempotent: remove a stale E2E user from a prior run, then recreate.
  const { data: list } = await admin.auth.admin.listUsers();
  const existing = list?.users?.find((u) => u.email === E2E_EMAIL);
  if (existing) await admin.auth.admin.deleteUser(existing.id);

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: E2E_EMAIL,
    password: E2E_PASSWORD,
    email_confirm: true,
  });
  if (createErr) throw new Error(`E2E createUser failed: ${createErr.message}`);

  // Super-admin so the user can load/save the unassigned seed company (the
  // Phase 3 RLS gap blocks regular licensees from reading any company).
  const { error: adminErr } = await admin
    .from('profiles')
    .update({ is_super_admin: true })
    .eq('id', created.user.id);
  if (adminErr) throw new Error(`E2E makeSuperAdmin failed: ${adminErr.message}`);

  // Reset the seed company to baseline (upsert in case db reset wasn't run).
  const { error: seedErr } = await admin
    .from('companies')
    .upsert({ id: SEED_COMPANY_ID, name: 'My Company', archived: false, config: SEED_CONFIG });
  if (seedErr) throw new Error(`E2E seed company reset failed: ${seedErr.message}`);
}
