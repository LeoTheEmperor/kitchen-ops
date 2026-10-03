import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">Heizen Starter</h1>
      <Link href="/login" className="rounded bg-black px-4 py-2 text-white">
        Go to login
      </Link>
    </main>
  );
}
