import { Card } from "@/components/ui/Card";

export default function MarketingPage() {
  return (
    <section className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="font-display text-2xl text-text mb-1">Marketing</h1>
      <p className="text-textMuted mb-8">Campaigns, social posts, and email — visual preview, not built yet.</p>
      <Card className="p-8 text-center text-textMuted text-sm">No campaigns yet.</Card>
    </section>
  );
}
