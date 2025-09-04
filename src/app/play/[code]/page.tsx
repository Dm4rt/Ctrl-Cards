"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Room = { id: string; code: string; status: string; host_id: string; };
type Member = { id: string; user_id: string; role: string; score: number; };

export default function PlayPage({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: r } = await supabase.from("rooms").select("*").eq("code", code).single();
      if (r) {
        setRoom(r);
        const { data: m } = await supabase.from("room_members").select("*").eq("room_id", r.id);
        setMembers(m ?? []);
      }
      setLoading(false);
    })();
  }, [code]);

  if (loading) return <div className="p-6">Loading room…</div>;
  if (!room) return <div className="p-6">Room not found.</div>;

  return (
    <main className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Room {room.code}</h1>
      <p>Status: {room.status}</p>
      <h2 className="text-lg font-semibold">Players</h2>
      <ul className="list-disc pl-6">
        {members.map(m => (
          <li key={m.id}>{m.user_id.slice(0,8)}… — {m.role} — {m.score} pts</li>
        ))}
      </ul>
    </main>
  );
}
