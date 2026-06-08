// Seed-company baseline + reset helper, shared by global-setup (once per run)
// and a per-test beforeEach (so no spec inherits another's saved state).
//
// Uses the Supabase service_role key (bypasses RLS), injected by the
// `test:e2e` npm script from `supabase status`. Refuses any non-local URL,
// mirroring the safety model of tests/integration/setup.js.

import WS from 'ws';
import { createClient } from '@supabase/supabase-js';
import { LOCAL_SUPABASE_URL } from './credentials.js';

// supabase-js spins up a Realtime client needing a global WebSocket; Node < 22
// (CI's Node 20) lacks one. No-op on Node 22+.
if (!globalThis.WebSocket) globalThis.WebSocket = WS;

// Baseline the seed company is reset to — mirrors supabase/seed.sql so tests
// never inherit drift (e.g. a service line a prior test saved).
export const SEED_COMPANY_ID = 'co_default1';
export const SEED_CONFIG = {
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

// Builds an RLS-bypassing admin client, refusing non-local URLs.
export function adminClient() {
  const url = process.env.VITE_SUPABASE_URL || LOCAL_SUPABASE_URL;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url !== LOCAL_SUPABASE_URL && url !== 'http://localhost:54321') {
    throw new Error(
      `E2E seed helper refuses to run against a non-local Supabase URL.\n` +
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

  return createClient(url, svcKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Resets the seed company to baseline. Upsert so it works whether or not the
// row exists yet. Pass an existing admin client to avoid re-creating one.
export async function resetSeedCompany(admin = adminClient()) {
  const { error } = await admin
    .from('companies')
    .upsert({ id: SEED_COMPANY_ID, name: 'My Company', archived: false, config: SEED_CONFIG });
  if (error) throw new Error(`E2E seed company reset failed: ${error.message}`);
}
