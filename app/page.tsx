import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 border-b border-line max-w-5xl mx-auto w-full">
        <span className="font-display text-lg text-ink">BizStack</span>
        <nav className="flex gap-4 text-sm">
          <Link href="/login" className="text-ink/70 hover:text-ink">
            Log in
          </Link>
          <Link
            href="/signup"
            className="bg-moss text-paper px-4 py-2 rounded-sm hover:bg-moss/90"
          >
            Start free
          </Link>
        </nav>
      </header>

      <section className="max-w-3xl mx-auto px-6 py-24 text-center">
        <h1 className="font-display text-4xl sm:text-5xl leading-tight text-ink">
          Run the business.
          <br />
          Not the paperwork.
        </h1>
        <p className="mt-6 text-lg text-ink/70 max-w-xl mx-auto">
          Invoicing, customers, stock, and books — one place, one AI layer
          that does the writing, chasing, and reconciling for you.
        </p>
        <div className="mt-10">
          <Link
            href="/signup"
            className="inline-block bg-clay text-paper px-6 py-3 rounded-sm text-base hover:bg-clay/90"
          >
            Create your business account
          </Link>
        </div>
      </section>
    </main>
  );
}
