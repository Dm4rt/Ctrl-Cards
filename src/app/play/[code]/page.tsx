"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Room = {
  id: string;
  code: string;
  status: string;
  host_id: string | null;
  deck_id: string | null;
};

type Member = {
  id: string;
  user_id: string;
  role: "host" | "player" | "spectator";
  score: number;
};

type Round = {
  id: string;
  room_id: string;
  prompt_card_id: string | null;
  state: "submitting" | "complete";
  winning_play_id: string | null;
};

type Play = {
  id: string;
  round_id: string;
  player_user_id: string;
  text: string | null;
  image_url: string | null;
};

type Card = { id: string; text: string };

export default function PlayPage({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();

  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [deckName, setDeckName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const [round, setRound] = useState<Round | null>(null);
  const [promptText, setPromptText] = useState<string | null>(null);

  const [hand, setHand] = useState<string[]>([]);
  const [myPlayId, setMyPlayId] = useState<string | null>(null);
  const [plays, setPlays] = useState<Play[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  async function loadMembers(roomId: string) {
    const { data, error } = await supabase
      .from("room_members")
      .select("id,user_id,role,score")
      .eq("room_id", roomId);
    if (error) console.error("[members] load error:", error);
    setMembers((data ?? []) as Member[]);
  }

  async function loadLatestRound(roomId: string) {
    const { data, error } = await supabase
      .from("rounds")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) console.error("[rounds] load error:", error);
    const rr = (data as Round) ?? null;
    setRound(rr);
    return rr;
  }

  async function loadPromptText(cardId: string | null) {
    if (!cardId) {
      setPromptText(null);
      return;
    }
    const { data, error } = await supabase
      .from("cards")
      .select("text")
      .eq("id", cardId)
      .single();
    if (error) console.error("[cards] prompt load error:", error);
    setPromptText((data?.text as string | undefined) ?? null);
  }

  async function loadPlays(roundId: string) {
    const { data, error } = await supabase
      .from("plays")
      .select("id,round_id,player_user_id,text,image_url")
      .eq("round_id", roundId);
    if (error) console.error("[plays] load error:", error);
    setPlays((data ?? []) as Play[]);
  }

  // Initial page load
  useEffect(() => {
    (async () => {
      setLoading(true);

      const { data: r, error: rErr } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", code)
        .single();

      if (rErr || !r) {
        console.error("[rooms] load error:", rErr);
        setRoom(null);
        setMembers([]);
        setDeckName("");
        setLoading(false);
        return;
      }

      console.log("[rooms] loaded:", r);
      setRoom(r as Room);
      await loadMembers(r.id);

      if (r.deck_id) {
        const { data: d, error: dErr } = await supabase
          .from("decks")
          .select("name")
          .eq("id", r.deck_id)
          .single();
        if (dErr) console.error("[decks] name load error:", dErr);
        setDeckName((d?.name as string) ?? "");
      } else {
        setDeckName("");
      }

      const last = await loadLatestRound(r.id);
      await loadPromptText(last?.prompt_card_id ?? null);
      if (last?.id) await loadPlays(last.id);

      setLoading(false);
    })();
  }, [code]);

  // Deal a simple hand whenever room/round changes
  useEffect(() => {
    (async () => {
      if (!room?.deck_id) return;
      const { data, error } = await supabase
        .from("cards")
        .select("id,text")
        .eq("deck_id", room.deck_id)
        .eq("type", "response")
        .limit(50);
      if (error) {
        console.error("[cards] hand load error:", error);
        return;
      }
      const responses = (data ?? []) as Card[];
      if (responses.length === 0) return;
      const shuffled = [...responses].sort(() => Math.random() - 0.5).slice(0, 3);
      setHand(shuffled.map((c) => c.text));
    })();
  }, [room?.deck_id, round?.id]);

  // Realtime + polling fallbacks
  useEffect(() => {
    if (!room?.id) return;

    // MEMBERS
    const chMembers = supabase
      .channel(`room-members:${room.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "room_members", filter: `room_id=eq.${room.id}` },
        (payload) => {
          console.log("[realtime] members INSERT:", payload);
          loadMembers(room.id);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "room_members", filter: `room_id=eq.${room.id}` },
        (payload) => {
          console.log("[realtime] members UPDATE:", payload);
          loadMembers(room.id);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "room_members", filter: `room_id=eq.${room.id}` },
        (payload) => {
          console.log("[realtime] members DELETE:", payload);
          loadMembers(room.id);
        }
      )
      .subscribe((status) => console.log("[realtime] members status:", status));

    const pollMembers = setInterval(() => loadMembers(room.id), 5000);

    // ROUNDS
    const chRounds = supabase
      .channel(`rounds:${room.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "rounds", filter: `room_id=eq.${room.id}` },
        async (payload) => {
          console.log("[realtime] rounds INSERT:", payload);
          const rr = payload.new as Round;
          setRound(rr);
          await loadPromptText(rr.prompt_card_id);
          setMyPlayId(null);
          setPlays([]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rounds", filter: `room_id=eq.${room.id}` },
        (payload) => {
          console.log("[realtime] rounds UPDATE:", payload);
          setRound(payload.new as Round);
        }
      )
      .subscribe((status) => console.log("[realtime] rounds status:", status));

    const pollRounds = setInterval(() => {
      if (room?.id) loadLatestRound(room.id).then((rr) => {
        if (rr) loadPromptText(rr.prompt_card_id);
      });
    }, 5000);

    // PLAYS
    const chPlays = supabase
      .channel(`plays:${room.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "plays" },
        (payload) => {
          const p = payload.new as Play;
          console.log("[realtime] plays INSERT:", payload);
          if (p.round_id === round?.id) setPlays((prev) => [...prev, p]);
        }
      )
      .subscribe((status) => console.log("[realtime] plays status:", status));

    const pollPlays = setInterval(() => {
      if (round?.id) loadPlays(round.id);
    }, 5000);

    return () => {
      supabase.removeChannel(chMembers);
      supabase.removeChannel(chRounds);
      supabase.removeChannel(chPlays);
      clearInterval(pollMembers);
      clearInterval(pollRounds);
      clearInterval(pollPlays);
    };
  }, [room?.id, round?.id]);

  // Host starts a round (random prompt from deck)
  async function startRound() {
    if (!room) return;
    console.log("[action] startRound");
    const { data: prompts, error: sErr } = await supabase
      .from("cards")
      .select("id,text")
      .eq("deck_id", room.deck_id)
      .eq("type", "prompt");

    if (sErr) {
      console.error("[cards] select prompts error:", sErr);
      alert("Could not load prompts: " + sErr.message);
      return;
    }
    const list = (prompts ?? []) as Card[];
    if (list.length === 0) {
      alert("No prompts in this deck.");
      return;
    }

    const prompt = list[Math.floor(Math.random() * list.length)];
    const { error: iErr } = await supabase
      .from("rounds")
      .insert({ room_id: room.id, prompt_card_id: prompt.id })
      .single();
    if (iErr) {
      console.error("[rounds] insert error:", iErr);
      alert("Could not start round: " + iErr.message);
      return;
    }
    // INSERT will trigger realtime → the UI will update
  }

  // Player submits one play
  async function submitPlay(text: string) {
    if (!round || !userId) return;
    console.log("[action] submitPlay");
    const { data, error } = await supabase
      .from("plays")
      .insert({ round_id: round.id, player_user_id: userId, text })
      .select()
      .single();
    if (error) {
      console.error("[plays] insert error:", error);
      if ((error.message || "").includes("plays_one_per_round")) {
        alert("You already submitted this round.");
      } else {
        alert("Submit failed: " + error.message);
      }
      return;
    }
    setMyPlayId(data.id as string);
  }

  // Host picks winner → mark round complete + +1 score
  async function pickWinner(playId: string) {
    if (!round || !room) return;
    console.log("[action] pickWinner", playId);

    const { error: e1 } = await supabase
      .from("rounds")
      .update({ state: "complete", winning_play_id: playId })
      .eq("id", round.id);
    if (e1) {
      console.error("[rounds] update error:", e1);
      alert("Could not complete round: " + e1.message);
      return;
    }

    const winner = plays.find((p) => p.id === playId);
    if (!winner) return alert("Winner not found.");

    const { data: cur, error: sErr } = await supabase
      .from("room_members")
      .select("score")
      .eq("room_id", room.id)
      .eq("user_id", winner.player_user_id)
      .single();
    if (sErr) {
      console.error("[room_members] score read error:", sErr);
      alert("Could not read score: " + sErr.message);
      return;
    }

    const newScore = (cur?.score ?? 0) + 1;
    const { error: uErr } = await supabase
      .from("room_members")
      .update({ score: newScore })
      .eq("room_id", room.id)
      .eq("user_id", winner.player_user_id);
    if (uErr) {
      console.error("[room_members] score update error:", uErr);
      alert("Could not update score: " + uErr.message);
      return;
    }
  }

  const amHost = useMemo(() => !!userId && room?.host_id === userId, [userId, room?.host_id]);

  if (loading) return <div className="p-6">Loading room…</div>;
  if (!room) return <div className="p-6">Room not found.</div>;

  return (
    <main className="max-w-xl mx-auto p-6 space-y-5">
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

      <section className="space-y-3">
        {amHost && (
          <button
            className="px-3 py-2 rounded bg-black text-white"
            onClick={startRound}
            disabled={round?.state === "submitting"}
          >
            {round ? "Start Next Round" : "Start Round"}
          </button>
        )}

        {round && (
          <div className="p-4 border rounded">
            <h3 className="font-semibold">Prompt</h3>
            <p>{promptText ?? "…"}</p>
            <p className="text-sm opacity-70 mt-1">Round: {round.state}</p>
          </div>
        )}

        {round && round.state === "submitting" && (
          <>
            <h4 className="font-semibold">Your hand</h4>
            {hand.map((t) => (
              <button
                key={t}
                disabled={!!myPlayId}
                className="block w-full border rounded px-3 py-2 text-left hover:bg-gray-100"
                onClick={() => submitPlay(t)}
              >
                {t}
              </button>
            ))}
            {myPlayId && <p className="text-sm mt-2">Submitted!</p>}
          </>
        )}

        {amHost && round && round.state === "submitting" && (
          <div className="mt-4 p-4 border rounded">
            <h4 className="font-semibold">Plays</h4>
            {plays.length === 0 && <p>No plays yet.</p>}
            {plays.map((p) => (
              <div key={p.id} className="flex items-center gap-2 py-1">
                <div className="flex-1">{p.text}</div>
                <button
                  className="px-2 py-1 rounded bg-black text-white"
                  onClick={() => pickWinner(p.id)}
                >
                  Pick winner
                </button>
              </div>
            ))}
          </div>
        )}

        {round && round.state === "complete" && (
          <div className="p-4 border rounded">
            <h4 className="font-semibold">Round complete</h4>
            {round.winning_play_id
              ? <p>Winner chosen! Start next round when ready.</p>
              : <p>Winner not set.</p>}
          </div>
        )}
      </section>
    </main>
  );
}
