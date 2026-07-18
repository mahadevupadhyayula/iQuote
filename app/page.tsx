export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-center text-white">
      <section className="max-w-2xl space-y-6">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
          iQuote
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          Capture ideas worth repeating.
        </h1>
        <p className="text-lg leading-8 text-slate-300">
          A minimal Next.js App Router starter configured with TypeScript strict
          mode and Tailwind CSS.
        </p>
      </section>
    </main>
  );
}
