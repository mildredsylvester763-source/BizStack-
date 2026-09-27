import Link from "next/link";

export function PageHeader({
  businessName,
  backHref = "/dashboard",
  backLabel = "Back to dashboard"
}: {
  businessName: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <header className="border-b border-rule bg-white">
      <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
        <Link href="/dashboard" className="font-display text-lg text-ink">
          {businessName}
        </Link>
        <Link href={backHref} className="text-sm text-ink/45 hover:text-ink">
          {backLabel}
        </Link>
      </div>
    </header>
  );
}
