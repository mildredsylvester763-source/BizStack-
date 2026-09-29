import Link from "next/link";
import { Card } from "@/components/ui/Card";

const SECTIONS = [
  { href: "/dashboard/settings/automation", label: "Automation", desc: "Autonomy per action type — live now." },
  { href: "/dashboard/settings/payments", label: "Payment methods", desc: "Bank details shown on invoices — live now." },
  { href: "#", label: "Business profile", desc: "Name, address, currency, logo — coming soon." },
  { href: "#", label: "Team & permissions", desc: "Invite staff, set roles — coming soon." }
];

export default function SettingsPage() {
  return (
    <section className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="font-display text-2xl text-text mb-1">Settings</h1>
      <p className="text-textMuted mb-8">Your account, business, and preferences.</p>
      <div className="grid sm:grid-cols-2 gap-4">
        {SECTIONS.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="p-5 h-full hover:border-primary/40 transition-colors">
              <p className="text-text font-medium mb-1">{s.label}</p>
              <p className="text-sm text-textMuted">{s.desc}</p>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
