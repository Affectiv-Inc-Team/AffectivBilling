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

  if (session === undefined) return null; // loading

  if (!session) return <LoginPage />;

  return <ToolPage userRole="licensor" />;
}
