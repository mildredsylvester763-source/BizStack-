import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

const CONNECTORS = [
  { name: "GitHub", desc: "Code & repositories" },
  { name: "Stripe", desc: "Payments" },
  { name: "Google Drive", desc: "File storage" },
  { name: "Slack", desc: "Team communication" },
  { name: "QuickBooks", desc: "Accounting" },
  { name: "WhatsApp", desc: "Customer messaging" }
];

export default function IntegrationsPage() {
  return (
    <section className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="font-display text-2xl text-text mb-1">Integrations</h1>
      <p className="text-textMuted mb-8">Connect your favorite tools — visual preview, connections aren't live yet.</p>
      <div className="grid sm:grid-cols-3 gap-4">
        {CONNECTORS.map((c) => (
          <Card key={c.name} className="p-5">
            <p className="text-text font-medium mb-1">{c.name}</p>
            <p className="text-sm text-textMuted mb-4">{c.desc}</p>
            <Button variant="outline" className="w-full" disabled>Coming soon</Button>
          </Card>
        ))}
      </div>
    </section>
  );
}
