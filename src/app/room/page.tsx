"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { makeCode } from "@/lib/roomCode";
import { useRouter } from "next/navigation";

type Deck = { id: string; name: string; is_public: boolean; };

export default function RoomHome() {
  const r = useRouter();
  const [code, setCode] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [deckId, setDeckId] = useState<string>("");   // selected deck

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // load public decks + my decks
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("decks")
        .select("id,name,is_public")
        .or("is_public.eq.true,owner_id.eq." + (userId ?? "00000000-0000-0000-0000-000000000000"))
        .order("is_public", { ascending: false })
        .order("name", { ascending: true });
      setDecks(data ?? []);
      // default select first deck if any
      if ((data?.length ?? 0) > 0) setDeckId(data![0].id);
    })();
  }, [userId]);

  async function createRoom() {
    if (!userId) return alert("Sign in first.");
    if (!deckId) return alert("Pick a deck first.");
    const newCode = makeCode();

    const { data: room, error } = await supabase
      .from("rooms")
      .insert({ code: newCode, host_id: userId, deck_id: deckId })
      .select()
      .single();
    if (error) return alert(error.message);

    await supabase.from("room_members").insert({
      room_id: room.id, user_id: userId, role: "host"
    });

    r.push(`/play/${room.code}`);
  }

  async function joinRoom() {
    if (!userId) return alert("Sign in first.");
    const codeClean = code.trim().toUpperCase();

    const { data: room, error: roomErr } = await supabase
      .from("rooms").select("*").eq("code", codeClean).single();
    if (roomErr || !room) return alert("Room not found.");

    const { error: upsertErr } = await supabase
      .from("room_members")
      .upsert([{ room_id: room.id, user_id: userId, role: "player" }], { onConflict: "room_id,user_id" });
    if (upsertErr) return alert(`Join failed: ${upsertErr.message}`);

    r.push(`/play/${room.code}`);
  }

  return (
    <main className="max-w-xl mx-auto p-6 space-y-6">
      <h2 className="text-xl font-semibold">Create / Join Room</h2>

      {/* Deck picker */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">Pick a deck for your room</label>
        <select
          className="border rounded px-3 py-2 w-full"
          value={deckId}
          onChange={(e)=>setDeckId(e.target.value)}
        >
          {decks.map(d => (
            <option key={d.id} value={d.id}>
              {d.name}{d.is_public ? " (public)" : " (mine)"}
            </option>
          ))}
        </select>
        <button
          className="px-3 py-2 rounded bg-black text-white disabled:opacity-50"
          onClick={createRoom}
          disabled={!deckId}
        >
          Create new room with deck
        </button>
        {decks.length === 0 && (
          <p className="text-sm">No decks yet. Use the starter deck seeding or create your own.</p>
        )}
      </div>

      {/* Join by code */}
      <div className="space-y-2">
        <input
          className="border rounded px-3 py-2 w-full uppercase"
          placeholder="ENTER CODE"
          value={code}
          onChange={(e)=>setCode(e.target.value)}
        />
        <button className="px-3 py-2 rounded bg-black text-white" onClick={joinRoom}>
          Join
        </button>
      </div>
    </main>
  );
}
