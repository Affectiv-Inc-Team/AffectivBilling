# Auth Implementation Plan (Track B)

This document describes the changes needed to wire up real Supabase authentication.
Currently `App.jsx` skips auth entirely and `LoginPage.jsx` is an empty stub.

---

## Files to change

### 1. `src/pages/LoginPage.jsx`

Replace the stub with a real email/password form using `supabase.auth.signInWithPassword`.

```jsx
import { useState } from "react";
import { supabase } from "../supabase.js";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
    // On success, App.jsx's onAuthStateChange listener fires and re-renders to ToolPage
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Intrinsic</h1>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
      />
      {error && <p>{error}</p>}
      <button type="submit" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
```

---

### 2. `src/App.jsx`

Replace the single-line stub with a session-aware router. Uses `supabase.auth.getSession`
on mount and `supabase.auth.onAuthStateChange` to reactively switch between login and tool.

```jsx
import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";
import LoginPage from "./pages/LoginPage.jsx";
import ToolPage from "./pages/ToolPage.jsx";

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) return null; // loading — optionally show a spinner

  if (!session) return <LoginPage />;

  return <ToolPage userRole="licensor" />;
}
```

---

## How it works end-to-end

1. App mounts → calls `getSession()` → no session → renders `<LoginPage />`
2. User submits credentials → `signInWithPassword` → Supabase sets a session cookie/token
3. `onAuthStateChange` fires with the new session → `App` re-renders → `<ToolPage />` loads
4. `ToolPage` calls `loadConfig()` → `loadConfig` calls `supabase.auth.getSession()` → session exists → queries `companies` table
5. On sign-out (future): call `supabase.auth.signOut()` → `onAuthStateChange` fires with `null` → back to `<LoginPage />`

---

## Notes

- `ToolPage.jsx` requires no changes — it already calls `loadConfig`/`saveConfig` from `supabase.js`.
- The `userRole` prop passed to `ToolPage` is hardcoded to `"licensor"` for now. Track B should
  derive this from `profiles.is_super_admin` after the session is established.
- No redirect library needed — the session state in `App` acts as the router.
- Sign-out UI (a button calling `supabase.auth.signOut()`) can be added anywhere in `FinancialTool.jsx`
  or a future nav component.
