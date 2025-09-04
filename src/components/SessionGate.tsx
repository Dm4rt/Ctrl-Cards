"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Auth from "./Auth";

export default function SessionGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setUserId(sess?.user.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) return <div>Loading…</div>;
  if (!userId) return <Auth />;
  return <>{children}</>;
}
