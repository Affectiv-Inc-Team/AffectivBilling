// Removes the E2E identity created by global-setup.js. The seed company is
// left in place (global-setup resets it at the start of the next run).

import WS from 'ws';
import { createClient } from '@supabase/supabase-js';
import { E2E_EMAIL, LOCAL_SUPABASE_URL } from './fixtures/credentials.js';

if (!globalThis.WebSocket) globalThis.WebSocket = WS;

export default async function globalTeardown() {
  const url = process.env.VITE_SUPABASE_URL || LOCAL_SUPABASE_URL;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!svcKey) return; // nothing we can clean up without admin access

  const admin = createClient(url, svcKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: list } = await admin.auth.admin.listUsers();
  const user = list?.users?.find((u) => u.email === E2E_EMAIL);
  if (user) await admin.auth.admin.deleteUser(user.id);
}
