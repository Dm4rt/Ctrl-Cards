"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Room = { id: string; code: string; status: string; host_id: string | null; deck_id: string | null; };
type Member = { id: string; user_id: string; role: "host" | "player" | "spectator"; score: number; };

export default function PlayPage({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();

  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [deckName, setDeckName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  async function loadMembers(roomId: string) {
    const { data, error } = await supabase
      .from("room_members")
      .select("id,user_id,role,score")
      .eq("room_id", roomId);
    if (error) console.error("loadMembers error:", error);
    setMembers((data ?? []) as Member[]);
  }

  // Initial load
  useEffect(() => {
    (async () => {
      setLoading(true);

      const { data: r, error: rErr } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", code)
        .single();

      if (rErr || !r) {
        console.error("rooms load error:", rErr);
        setRoom(null);
        setMembers([]);
        setDeckName("");
        setLoading(false);
        return;
      }

      setRoom(r as Room);
      await loadMembers(r.id);

      if (r.deck_id) {
        const { data: d } = await supabase
          .from("decks")
          .select("name")
          .eq("id", r.deck_id)
          .single();
        setDeckName(d?.name ?? "");
      } else {
        setDeckName("");
      }

      setLoading(false);
    })();
  }, [code]);

  // Realtime subscription + fallback polling
  useEffect(() => {
    if (!room?.id) return;

    console.log("[realtime] subscribing for room_id:", room.id);

    const channel = supabase.channel(`room-members:${room.id}`);

    const onChange = (payload: unknown) => {
      console.log("[realtime] room_members change:", payload);
      loadMembers(room.id);
    };

    channel
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_members", filter: `room_id=eq.${room.id}` }, onChange)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "room_members", filter: `room_id=eq.${room.id}` }, onChange)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "room_members", filter: `room_id=eq.${room.id}` }, onChange)
      .subscribe((status) => {
        console.log("[realtime] subscribe status:", status);
      });

    // Fallback polling every 5s (cheap & safe for small rooms)
    const poll = setInterval(() => loadMembers(room.id), 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [room?.id]);

  if (loading) return <div className="p-6">Loading room…</div>;
  if (!room) return <div className="p-6">Room not found.</div>;

  return (
    <main className="max-w-xl mx-auto p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Room {room.code}</h1>
        <p className="opacity-80">Status: {room.status}</p>
        {deckName && <p className="opacity-80 text-sm">Deck: {deckName}</p>}
      </div>

      <section>
        <h2 className="text-lg font-semibold">Players</h2>
        <ul className="list-disc pl-6">
          {members.map((m) => (
            <li key={m.id}>
              {m.user_id.slice(0, 8)}… — {m.role} — {m.score} pts
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
