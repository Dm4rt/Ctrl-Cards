"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ProfilePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (!uid) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", uid)
        .maybeSingle();
      setUsername(p?.username ?? "");
    })();
  }, []);

  async function save() {
    if (!userId) return;
    try {
      setSaving(true);
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: userId, username });
      if (error && (error as any).code === "23505") {
        alert("That username is taken. Try another.");
        return;
      }
      if (error) throw error;
      alert("Saved!");
    } catch (e: any) {
      alert(e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Your profile</h1>
      <input className="border rounded px-3 py-2 w-full"
             placeholder="Username"
             value={username}
             onChange={(e)=>setUsername(e.target.value)} />
      <button onClick={save} disabled={saving} className="px-4 py-2 rounded bg-black text-white">
        {saving ? "Saving…" : "Save"}
      </button>
    </main>
  );
}
