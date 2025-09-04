"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

function getErrMsg(e: unknown) {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try { return JSON.stringify(e); } catch { return "Unknown error"; }
}

export default function SignInPage() {
  const r = useRouter();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) throw error;

      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (uid) {
        const { data: p } = await supabase
          .from("profiles").select("username")
          .eq("id", uid).maybeSingle();
        if (!p?.username) {
          r.push("/profile");
          return;
        }
      }
      r.push("/room");
    } catch (err: unknown) {
      alert(getErrMsg(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input className="border rounded px-3 py-2 w-full" placeholder="Email"
               value={email} onChange={(e)=>setEmail(e.target.value)} />
        <input className="border rounded px-3 py-2 w-full" type="password" placeholder="Password"
               value={pw} onChange={(e)=>setPw(e.target.value)} />
        <button disabled={loading} className="px-4 py-2 rounded bg-black text-white">
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
