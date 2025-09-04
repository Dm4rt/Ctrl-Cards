"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function NavBar() {
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        const { data: p } = await supabase
          .from("profiles")
          .select("id,username")
          .eq("id", uid)
          .maybeSingle();
        setUsername(p?.username ?? "");
      }
    })();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    location.href = "/";
  }

  return (
    <header className="w-full border-b">
      <nav className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-semibold">CAH-ish</Link>
        <div className="flex items-center gap-4">
          <Link href="/room" className="underline">Rooms</Link>
          {!userId ? (
            <>
              <Link href="/auth/sign-in" className="underline">Sign in</Link>
              <Link href="/auth/sign-up" className="underline">Sign up</Link>
            </>
          ) : (
            <>
              <Link href="/profile" className="underline">
                {username ? `@${username}` : "Profile"}
              </Link>
              <button onClick={signOut} className="text-sm px-3 py-1 rounded bg-black text-white">
                Sign out
              </button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
