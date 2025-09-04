"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

function getErrMsg(e: unknown) {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try { return JSON.stringify(e); } catch { return "Unknown error"; }
}
function getPgCode(e: unknown): string | undefined {
  if (typeof e === "object" && e && "code" in e) {
    const val = (e as { code?: unknown }).code;
    return typeof val === "string" ? val : undefined;
  }
  return undefined;
}

export default function SignUpPage() {
  const r = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !username || !pw) return alert("Fill all fields.");
    if (pw !== pw2) return alert("Passwords do not match.");

    try {
      setLoading(true);
      const { data: sign, error: signErr } = await supabase.auth.signUp({
        email,
        password: pw,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      if (signErr) throw signErr;

      const uid = sign.user?.id;
      if (uid) {
        const { error: profErr } = await supabase
          .from("profiles")
          .insert({ id: uid, username });

        if (profErr) {
          if (getPgCode(profErr) === "23505") {
            throw new Error("Username is taken. Pick another.");
          }
          throw profErr;
        }
        r.push("/room");
      } else {
        alert("Check your email to confirm, then sign in.");
        r.push("/auth/sign-in");
      }
    } catch (err: unknown) {
      alert(getErrMsg(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Create account</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input className="border rounded px-3 py-2 w-full" placeholder="Email"
               value={email} onChange={(e)=>setEmail(e.target.value)} />
        <input className="border rounded px-3 py-2 w-full" placeholder="Username"
               value={username} onChange={(e)=>setUsername(e.target.value)} />
        <input className="border rounded px-3 py-2 w-full" type="password" placeholder="Password"
               value={pw} onChange={(e)=>setPw(e.target.value)} />
        <input className="border rounded px-3 py-2 w-full" type="password" placeholder="Confirm password"
               value={pw2} onChange={(e)=>setPw2(e.target.value)} />
        <button disabled={loading} className="px-4 py-2 rounded bg-black text-white">
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>
    </main>
  );
}
