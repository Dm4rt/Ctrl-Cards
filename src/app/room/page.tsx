"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { makeCode } from "@/lib/roomCode";
import { useRouter } from "next/navigation";

export default function RoomHome() {
  const r = useRouter();
  const [code, setCode] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  async function createRoom() {
    if (!userId) return alert("Sign in first.");
    const newCode = makeCode();

    // just pick first public deck for now
  const { data: deck } = await supabase
    .from("decks")
    .select("id")
    .eq("is_public", true)
    .limit(1)
    .single();
  if (!deck) return alert("No deck found.");
  
    const { data: room, error } = await supabase
      .from("rooms")
      .insert({ code: newCode, host_id: userId })
      .select()
      .single();
    if (error) return alert(error.message);
    // add host as member
    await supabase.from("room_members").insert({ room_id: room.id, user_id: userId, role: "host" });
    r.push(`/play/${room.code}`);
  }

  async function joinRoom() {
  if (!userId) return alert("Sign in first.");
  const codeClean = code.trim().toUpperCase();

  // 1) Find the room by code
  const { data: room, error: roomErr } = await supabase
    .from("rooms")
    .select("*")
    .eq("code", codeClean)
    .single();
  if (roomErr || !room) {
    console.error("rooms.select error:", roomErr);
    return alert("Room not found.");
  }

  // 2) Insert (or update) membership
  const { error: upsertErr } = await supabase
    .from("room_members")
    .upsert(
      [{ room_id: room.id, user_id: userId, role: "player" }],
      { onConflict: "room_id,user_id" }
    );
  if (upsertErr) {
    console.error("room_members.upsert error:", upsertErr);
    return alert(`Join failed: ${upsertErr.message}`);
  }

  // 3) Navigate
  r.push(`/play/${room.code}`);
}


  return (
    <main className="max-w-xl mx-auto p-6 space-y-6">
      <h2 className="text-xl font-semibold">Create / Join Room</h2>
      <div className="space-y-3">
        <button className="px-3 py-2 rounded bg-black text-white" onClick={createRoom}>
          Create new room
        </button>
      </div>
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
