import { useState, useEffect } from "react";
import { supabase, getProfile } from "./supabase.js";
import { ROLES, ROLE_LABELS } from "./lib/access.js";
import LoginPage from "./pages/LoginPage.jsx";
import ToolPage from "./pages/ToolPage.jsx";

const IS_DEV = import.meta.env.DEV;

function deriveRole(profile) {
  if (!profile) return ROLES.CEO;             // fallback until Track B
  if (profile.is_super_admin) return ROLES.OWNER;
  return profile.role ?? ROLES.CEO;           // role col added in Track B
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [profile, setProfile] = useState(null);
  const [devRole, setDevRole] = useState(null);       // null = use derived role

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) getProfile().then(setProfile);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) getProfile().then(setProfile);
      else setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) return null; // loading

  if (!session) return <LoginPage />;

  const derivedRole   = deriveRole(profile);
  const effectiveRole = IS_DEV && devRole ? devRole : derivedRole;

  return (
    <>
      <ToolPage userRole={effectiveRole} />
      {IS_DEV && (
        <div style={{
          position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
          background: '#1e293b', borderRadius: 8, padding: '8px 12px',
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}>
          <span style={{
            color: '#94a3b8', fontSize: 10, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: 1,
            fontFamily: 'monospace',
          }}>
            Dev Role
          </span>
          <select
            value={devRole ?? ''}
            onChange={e => setDevRole(e.target.value || null)}
            style={{
              background: '#334155', color: '#f1f5f9',
              border: '1px solid #475569', borderRadius: 4,
              padding: '3px 6px', fontSize: 11, cursor: 'pointer',
            }}
          >
            <option value="">← derived ({ROLE_LABELS[derivedRole]})</option>
            {Object.entries(ROLE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}
