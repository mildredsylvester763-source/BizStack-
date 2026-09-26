import Link from "next/link";

const FEATURES = [
  {
    title: "It writes the invoice",
    body: "Tell it what happened in plain words. It drafts, sends, and chases payment."
  },
  {
    title: "It watches the money",
    body: "Cash flow, overdue invoices, and margin — reconciled without you touching a spreadsheet."
  },
  {
    title: "It answers the customer",
    body: "WhatsApp, email, and chat land in one inbox the AI can act on directly."
  }
];

export default function Home() {
  return (
    <main className="min-h-screen bg-noise">
      <header className="border-b border-line">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <span className="font-display text-xl text-ink tracking-tight">
            BizStack
          </span>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/login" className="text-ink/70 hover:text-ink px-3 py-2">
              Log in
            </Link>
            <Link
              href="/signup"
              className="bg-mossDeep text-paper px-4 py-2 rounded-full hover:bg-moss transition-colors"
            >
              Start free
            </Link>
          </nav>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-20 pb-24">
        <div className="max-w-2xl">
          <span className="inline-block text-xs tracking-widest uppercase text-clay font-semibold mb-6">
            One system. Every part of the business.
          </span>
          <h1 className="font-display text-5xl sm:text-6xl leading-[1.05] text-ink">
            Run the business.
            <br />
            Not the paperwork.
          </h1>
          <p className="mt-7 text-lg text-ink/70 max-w-lg leading-relaxed">
            Invoicing, customers, stock, and books — one place, one AI layer
            that does the writing, chasing, and reconciling for you.
          </p>
          <div className="mt-10 flex items-center gap-4">
            <Link
              href="/signup"
              className="inline-block bg-clay text-paper px-7 py-3.5 rounded-full text-base font-medium hover:bg-clay/90 transition-colors shadow-soft"
            >
              Create your business account
            </Link>
            <Link
              href="/login"
              className="text-ink/70 hover:text-ink text-sm underline underline-offset-4"
            >
              I already have one
            </Link>
          </div>
        </div>

        <div className="mt-24 grid sm:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-white/60 border border-line rounded-2xl p-6 shadow-soft"
            >
              <div className="w-9 h-9 rounded-full bg-mossDeep/10 flex items-center justify-center mb-4">
                <div className="w-2.5 h-2.5 rounded-full bg-mossDeep" />
              </div>
              <h3 className="font-display text-lg text-ink mb-2">
                {f.title}
              </h3>
              <p className="text-sm text-ink/65 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="max-w-6xl mx-auto px-6 py-8 text-sm text-ink/50 flex items-center justify-between">
          <span>BizStack</span>
          <span>Built for businesses that don't have time for six different tools.</span>
        </div>
      </footer>
    </main>
  );
}
