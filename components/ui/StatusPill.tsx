const STATUS_STYLES: Record<string, string> = {
  draft: "bg-textMuted/15 text-textMuted",
  sent: "bg-primary/15 text-primary",
  paid: "bg-success/15 text-success",
  overdue: "bg-danger/15 text-danger",
  info: "bg-textMuted/15 text-textMuted",
  needs_approval: "bg-warning/15 text-warning",
  auto_handled: "bg-success/15 text-success",
  active: "bg-success/15 text-success"
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-block text-xs px-2.5 py-1 rounded-full capitalize ${
        STATUS_STYLES[status] ?? "bg-textMuted/15 text-textMuted"
      }`}
    >
      {status.replace("_", " ")}
    </span>
  );
}
