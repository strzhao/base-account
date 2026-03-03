import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="panel">
        <h1>Base Account Service</h1>
        <p>Centralized account service for all Vercel products.</p>
        <div className="inline-actions">
          <Link href="/login">Go to Login</Link>
          <span>·</span>
          <Link href="/admin">Open Admin Console</Link>
          <span>·</span>
          <Link href="/docs">Open Integration Docs</Link>
        </div>
      </section>
    </main>
  );
}
