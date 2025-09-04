"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Room = {
  id: string;
  code: string;
  status: string;
  host_id: string;
  deck_id: string; // ⬅️ required to fetch cards
};

type Member = {
  id: string;       // row id in room_members
  room_id: string;
  user_id: string;
  role: string;     // "host" | "player"
  score: number;
};

type Submission = {
  id: string;
  room_id: string;
  user_id: string;
  text: string;
  created_at: string;
};

export default function PlayPage({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const r = useRouter();

  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);

  // prompt / hand / selection
  const [prompt, setPrompt] = useState<string | null>(null);
  const [hand, setHand] = useState<string[]>([]);
  const [myPlay, setMyPlay] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pollRef = useRef<number | null>(null);

  // ---- Auth: get current user once ----
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
    })();
  }, []);

  // ---- Load room + members ----
  async function fetchRoomAndMembers() {
    setError(null);

    const { data: rData, error: rErr } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", code)
      .single();

    if (rErr || !rData) {
      setError(`rooms error: ${rErr?.message ?? "not found"}`);
      setLoading(false);
      return;
    }
    setRoom(rData as Room);

    const { data: mData, error: mErr } = await supabase
      .from("room_members")
      .select("*")
      .eq("room_id", rData.id);

    if (mErr) setError(`members error: ${mErr.message}`);
    setMembers((mData ?? []) as Member[]);
    setLoading(false);
  }

  useEffect(() => {
    fetchRoomAndMembers();
    pollRef.current = window.setInterval(fetchRoomAndMembers, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // ---- Load prompt + hand when room is ready ----
  useEffect(() => {
    if (!room) return;

    // 1) One prompt for now (TODO: randomize with RPC or server-side selection)
    supabase
      .from("cards")
      .select("text")
      .eq("deck_id", room.deck_id)
      .eq("type", "prompt")
      .limit(1)
      .single()
      .then(({ data, error }) => {
        if (error) console.error("prompt load error:", error);
        setPrompt(data?.text ?? null);
      });

    // 2) Three response cards as hand
    supabase
      .from("cards")
      .select("text")
      .eq("deck_id", room.deck_id)
      .eq("type", "response")
      .limit(3)
      .then(({ data, error }) => {
        if (error) console.error("hand load error:", error);
        setHand((data ?? []).map((c: any) => c.text));
        setMyPlay(null);
      });
  }, [room]);

  // ---- Poll submissions so host can see them live ----
  async function fetchSubmissions() {
    if (!room) return;
    const { data, error } = await supabase
      .from("round_submissions") // ⬅️ table name: adjust if different
      .select("*")
      .eq("room_id", room.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("submissions error:", error);
      return;
    }
    setSubmissions((data ?? []) as Submission[]);
  }

  useEffect(() => {
    if (!room) return;
    fetchSubmissions();
    const t = window.setInterval(fetchSubmissions, 1500);
    return () => clearInterval(t);
  }, [room]);

  // ---- Player submits play ----
  async function submitPlay() {
    if (!userId) return alert("Sign in first.");
    if (!room) return alert("Room missing.");
    if (!myPlay) return alert("Pick a card to submit.");

    setSubmitting(true);

    // If you want to prevent multiple submissions per user/room,
    // create a UNIQUE index on (room_id, user_id) and use upsert:
    // .upsert([{ room_id: room.id, user_id: userId, text: myPlay }], { onConflict: "room_id,user_id" })
    const { error } = await supabase.from("round_submissions").insert({
      room_id: room.id,
      user_id: userId,
      text: myPlay,
    });

    setSubmitting(false);

    if (error) {
      console.error("submit error:", error);
      return alert(`Submit failed: ${error.message}`);
    }
    alert("Submitted!");
    fetchSubmissions();
  }

  // ---- Host picks winner: increments winner's score and (optionally) clears submissions ----
  async function pickWinner(winnerUserId: string) {
    if (!room || !userId) return;
    if (room.host_id !== userId) return alert("Only the host can pick the winner.");

    // Find the member row to get current score
    const winnerMember = members.find((m) => m.user_id === winnerUserId);
    if (!winnerMember) return alert("Winner is not in members list.");

    const newScore = (winnerMember.score ?? 0) + 1;

    // Update the score
    const { error: updErr } = await supabase
      .from("room_members")
      .update({ score: newScore })
      .eq("room_id", room.id)
      .eq("user_id", winnerUserId);

    if (updErr) {
      console.error("score update error:", updErr);
      return alert(`Failed to update score: ${updErr.message}`);
    }

    // Optional: record the winner in a winners table
    // await supabase.from("round_winners").insert({ room_id: room.id, user_id: winnerUserId });

    // Optional: clear submissions to start next round
    // await supabase.from("round_submissions").delete().eq("room_id", room.id);

    alert("Winner picked! +1 point");
    fetchRoomAndMembers();
    fetchSubmissions();
  }

  if (loading) return <div className="p-6">Loading room…</div>;
  if (!room) return <div className="p-6">Room not found.</div>;

  return (
    <main className="max-w-xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Room {room.code}</h1>
        <p>Status: {room.status}</p>
        {error && <p className="text-red-500 text-sm mt-1">Debug: {error}</p>}
      </header>

      {/* Players */}
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

      {/* Prompt */}
      {prompt && (
        <section className="p-4 border rounded bg-white">
          <h2 className="font-bold">Prompt</h2>
          <p>{prompt}</p>
        </section>
      )}

      {/* Hand + choose card */}
      {hand.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-base font-medium">Your hand</h3>
          {hand.map((c) => (
            <button
              key={c}
              disabled={!!myPlay}
              className="block w-full border rounded px-3 py-2 text-left hover:bg-gray-100 disabled:opacity-50"
              onClick={() => setMyPlay(c)}
            >
              {c}
            </button>
          ))}
          {myPlay && <p className="mt-2">You played: {myPlay}</p>}
          {myPlay && (
            <button
              onClick={submitPlay}
              disabled={submitting}
              className="mt-2 rounded bg-black px-4 py-2 text-white disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit"}
            </button>
          )}
        </section>
      )}

      {/* Live submissions (everyone) */}
      <section className="space-y-2">
        <h3 className="text-base font-medium">Submissions</h3>
        {submissions.length === 0 && (
          <div className="text-gray-500">No submissions yet.</div>
        )}
        <ul className="space-y-2">
          {submissions.map((s) => (
            <li key={s.id} className="border rounded p-2">
              <div className="text-sm text-gray-600">
                by {s.user_id.slice(0, 8)}…
              </div>
              <div>{s.text}</div>
            </li>
          ))}
        </ul>
      </section>

      {/* Host-only: pick winner */}
      {room.host_id === userId && submissions.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-base font-semibold">Host Control</h3>
          <p className="text-sm text-gray-600">
            Pick a winner to award +1 point.
          </p>
          <div className="grid gap-2">
            {submissions.map((s) => (
              <button
                key={s.id}
                className="rounded border px-3 py-2 text-left hover:bg-gray-100"
                onClick={() => pickWinner(s.user_id)}
              >
                Pick: {s.text} <span className="text-gray-500">(by {s.user_id.slice(0, 8)}…)</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
