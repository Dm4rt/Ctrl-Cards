import Link from "next/link";

export default function Home() {
  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">CAH-ish</h1>
      <p>Create/join private rooms and play with custom decks.</p>
      <div className="flex gap-3">
        <Link href="/auth/sign-in" className="px-4 py-2 rounded bg-black text-white">Sign in</Link>
        <Link href="/auth/sign-up" className="px-4 py-2 rounded border">Create account</Link>
        <Link href="/room" className="px-4 py-2 rounded border">Go to Rooms</Link>
      </div>
    </main>
  );
}
