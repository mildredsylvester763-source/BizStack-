"use client";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type Message = { role: "assistant" | "user"; text: string };

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "Ask me to draft a marketing plan, write a product description, or summarize your sales — this preview isn't wired to a real model yet." }
  ]);
  const [draft, setDraft] = useState("");

  function send() {
    if (!draft.trim()) return;
    setMessages((prev) => [...prev, { role: "user", text: draft }]);
    setDraft("");
  }

  return (
    <section className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="font-display text-2xl text-text mb-1">AI Assistant</h1>
      <p className="text-textMuted mb-8">Your business copilot — visual preview, not yet connected to a real model.</p>
      <Card className="p-5 flex flex-col h-[420px]">
        <div className="flex-1 space-y-3 overflow-y-auto mb-4">
          {messages.map((m, i) => (
            <div key={i} className={`max-w-[80%] px-4 py-2.5 rounded-xl text-sm ${m.role === "assistant" ? "bg-surfaceAlt text-text" : "bg-primary text-white ml-auto"}`}>
              {m.text}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask anything..."
            className="flex-1 rounded-lg border border-line px-4 py-2.5 bg-bg text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <Button onClick={send}>Send</Button>
        </div>
      </Card>
    </section>
  );
}
