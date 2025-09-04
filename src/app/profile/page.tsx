"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type ProfileRow = { id: string; username: string | null };

function getPgCode(e: unknown): string | undefined {
  if (typeof e === "object" && e && "code" in e) {
    const val = (e as { code?: unknown }).code;
    return typeof val === "string" ? val : undefined;
  }
  return undefined;
}
function errMsg(e: unknown) {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try { return JSON.stringify(e); } catch { return "Unknown error"; }
}

export default function ProfilePage() {
  const r = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        r.push("/auth/sign-in");
        return;
      }
      setUserId(user.id);
      setEmail(user.email ?? "");

      const { data: p } = await supabase
        .from("profiles")
        .select("id,username")
        .eq("id", user.id)
        .maybeSingle();

      setUsername(p?.username ?? "");
      setLoading(false);
    })();
  }, [r]);

  async function save() {
    if (!userId) return;
    try {
      setSaving(true);
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: userId, username });
      if (error) {
        if (getPgCode(error) === "23505") {
          alert("That username is taken. Try another.");
          return;
        }
        throw error;
      }
      alert("Saved!");
    } catch (e) {
      alert(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="max-w-md mx-auto p-6">Loading…</main>;

  return (
    <main className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Your profile</h1>

      <div className="space-y-1">
        <label className="text-sm opacity-70">Email</label>
        <input
          className="border rounded px-3 py-2 w-full bg-gray-100"
          value={email}
          readOnly
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm opacity-70">Username</label>
        <input
          className="border rounded px-3 py-2 w-full"
          placeholder="Choose a username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="px-4 py-2 rounded bg-black text-white"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </main>
  );
}
