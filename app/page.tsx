import Link from "next/link";

const LINE_ITEMS = [
  {
    name: "Invoicing, handled",
    detail: "Say what happened. It drafts, sends, and chases the payment."
  },
  {
    name: "Books, reconciled",
    detail: "Every transaction categorized and matched, automatically."
  },
  {
    name: "Customers, answered",
    detail: "WhatsApp, email, and chat — one inbox, one AI that can act."
  },
  {
    name: "Stock, watched",
    detail: "Low inventory and reorder points flagged before they cost you."
  }
];

function LedgerIllustration() {
  return (
    <svg viewBox="0 0 360 440" className="w-full max-w-sm mx-auto" aria-hidden="true">
      <rect x="8" y="8" width="344" height="424" rx="6" fill="#FFFFFF" stroke="#D7DAD5" />
      <rect x="8" y="8" width="344" height="64" rx="6" fill="#123B33" />
      <text x="32" y="46" fontFamily="var(--font-display)" fontSize="22" fill="#EEF1EE">
        Invoice
      </text>
      <text x="332" y="46" fontFamily="var(--font-body)" fontSize="13" fill="#B98A2E" textAnchor="end">
        INV-0148
      </text>

      {[0, 1, 2, 3, 4, 5].map((i) => (
        <line
          key={i}
          x1="32"
          y1={110 + i * 30}
          x2={i % 2 === 0 ? 328 : 240}
          y2={110 + i * 30}
          stroke="#D7DAD5"
          strokeWidth="1.5"
        />
      ))}

      <line x1="32" y1="310" x2="328" y2="310" stroke="#12182B" strokeWidth="1.5" />
      <text x="328" y="336" fontFamily="var(--font-display)" fontSize="20" fill="#12182B" textAnchor="end">
        $1,240.00
      </text>

      <g transform="translate(255,355) rotate(-9)">
        <circle cx="0" cy="0" r="42" fill="none" stroke="#B98A2E" strokeWidth="2.5" />
        <circle cx="0" cy="0" r="35" fill="none" stroke="#B98A2E" strokeWidth="1" />
        <text
          x="0"
          y="6"
          fontFamily="var(--font-display)"
          fontStyle="italic"
          fontSize="16"
          fill="#B98A2E"
          textAnchor="middle"
        >
          Paid
        </text>
      </g>
    </svg>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-ledger">
      <header className="border-b border-rule bg-mist/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <span className="font-display italic text-xl text-ink">BizStack</span>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/login" className="text-ink/70 hover:text-ink px-3 py-2">
              Log in
            </Link>
            <Link
              href="/signup"
              className="bg-vault text-mist px-4 py-2 rounded-sm hover:bg-vaultDeep transition-colors"
            >
              Start free
            </Link>
          </nav>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-16 pb-24 grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <p className="text-brass text-sm font-medium mb-5">
            One system for a business that currently runs on six.
          </p>
          <h1 className="font-display text-5xl sm:text-6xl leading-[1.08] text-ink">
            Run the business.
            <br />
            <span className="italic">Not the paperwork.</span>
          </h1>
          <p className="mt-7 text-lg text-ink/70 max-w-md leading-relaxed">
            Invoicing, customers, stock, and books — one place, with an AI
            layer that does the writing, chasing, and reconciling for you.
          </p>
          <div className="mt-10 flex items-center gap-5">
            <Link
              href="/signup"
              className="inline-block bg-ink text-mist px-7 py-3.5 rounded-sm text-base font-medium hover:bg-vaultDeep transition-colors"
            >
              Create your business account
            </Link>
            <Link href="/login" className="text-ink/70 hover:text-ink text-sm">
              I already have one
            </Link>
          </div>
        </div>

        <LedgerIllustration />
      </section>

      <section className="border-t border-rule bg-white">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="font-display text-3xl text-ink mb-12 max-w-lg">
            Everything on the invoice, nothing left for you to do by hand.
          </h2>
          <div className="divide-y divide-rule border-t border-b border-rule">
            {LINE_ITEMS.map((item) => (
              <div
                key={item.name}
                className="py-6 grid sm:grid-cols-[240px_1fr] gap-4 sm:gap-10"
              >
                <p className="font-display text-lg text-ink">{item.name}</p>
                <p className="text-ink/65 leading-relaxed">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-vault text-mist/70">
        <div className="max-w-6xl mx-auto px-6 py-10 text-sm flex items-center justify-between">
          <span className="font-display italic text-mist">BizStack</span>
          <span>Built for businesses that don't have time for six different tools.</span>
        </div>
      </footer>
    </main>
  );
}
