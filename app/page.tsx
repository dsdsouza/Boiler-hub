import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold">Boilerplate</h1>
      <nav className="mt-4 flex gap-4 underline">
        {/* Route handler, not a page: plain anchor so Next does not prefetch it */}
        <a href="/auth/signin">Sign in with Google</a>
        <Link href="/demo">Try the demo</Link>
        <Link href="/how">How it works</Link>
      </nav>
    </main>
  );
}
