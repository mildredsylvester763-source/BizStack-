"use client";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function WebsiteBuilderPage() {
  const [prompt, setPrompt] = useState("");
  return (
    <section className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="font-display text-2xl text-text mb-1">Website Builder</h1>
      <p className="text-textMuted mb-8">AI-powered site generation — visual preview, generation isn't wired up yet.</p>
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-5">
          <p className="text-sm text-textMuted mb-2">Describe your website</p>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A modern business website for a bakery, with online ordering..."
            rows={5}
            className="w-full rounded-lg border border-line px-4 py-3 bg-bg text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <Button className="mt-3 w-full" disabled>
            Generate website (coming soon)
          </Button>
        </Card>
        <Card className="p-6 flex flex-col justify-center items-start bg-gradient-to-br from-surface to-surfaceAlt">
          <p className="font-display text-2xl text-text">Build Your<br />Digital Future</p>
          <p className="text-sm text-textMuted mt-2">Modern websites, powerful tools.</p>
          <Button className="mt-4" disabled>Get started</Button>
        </Card>
      </div>
    </section>
  );
}
