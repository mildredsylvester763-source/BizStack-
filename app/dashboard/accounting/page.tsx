import { Card } from "@/components/ui/Card";

export default function AccountingPage() {
  return (
    <section className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="font-display text-2xl text-text mb-1">Accounting</h1>
      <p className="text-textMuted mb-8">Full ledger, reconciliation, and tax — visual preview, not built yet.</p>
      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="p-5"><p className="text-xs text-textMuted mb-1">Revenue</p><p className="font-display text-2xl text-text">—</p></Card>
        <Card className="p-5"><p className="text-xs text-textMuted mb-1">Expenses</p><p className="font-display text-2xl text-text">—</p></Card>
        <Card className="p-5"><p className="text-xs text-textMuted mb-1">Net profit</p><p className="font-display text-2xl text-text">—</p></Card>
      </div>
    </section>
  );
}
