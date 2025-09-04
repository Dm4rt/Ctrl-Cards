import SessionGate from "@/components/SessionGate";
import Link from "next/link";

export default function Home() {
  return (
    <main className="max-w-xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">CAH-ish</h1>
      <SessionGate>
        <div className="space-y-4">
          <Link className="underline" href="/room">Create / Join Room</Link>
        </div>
      </SessionGate>
    </main>
  );
}
