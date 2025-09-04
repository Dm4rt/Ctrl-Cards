"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function signIn() {
  const redirectTo = `${window.location.origin}/`; // or /room if you prefer
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });
  if (!error) setSent(true);
  else alert(error.message);
}

  async function signOut() {
    await supabase.auth.signOut();
    location.reload();
  }

  return (
    <div className="space-y-3">
      {!sent ? (
        <>
          <input
            className="border rounded px-3 py-2 w-full"
            placeholder="you@example.com"
            value={email}
            onChange={e=>setEmail(e.target.value)}
          />
          <button className="px-3 py-2 rounded bg-black text-white" onClick={signIn}>
            Send magic link
          </button>
        </>
      ) : (
        <p>Check your email for the sign-in link.</p>
      )}
      <button className="text-sm underline" onClick={signOut}>Sign out</button>
    </div>
  );
}
