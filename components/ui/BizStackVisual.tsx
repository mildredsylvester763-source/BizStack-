"use client";

import { ReactNode } from "react";

export function BizIcon({
  children,
  tone = "blue",
  size = "md"
}: {
  children: ReactNode;
  tone?: "blue" | "purple" | "cyan" | "green" | "orange" | "red" | "slate";
  size?: "sm" | "md" | "lg";
}) {
  const tones: Record<string, string> = {
    blue: "bg-blue-500/15 border-blue-400/25 text-blue-300",
    purple: "bg-violet-500/15 border-violet-400/25 text-violet-300",
    cyan: "bg-cyan-500/15 border-cyan-400/25 text-cyan-300",
    green: "bg-emerald-500/15 border-emerald-400/25 text-emerald-300",
    orange: "bg-orange-500/15 border-orange-400/25 text-orange-300",
    red: "bg-rose-500/15 border-rose-400/25 text-rose-300",
    slate: "bg-white/[.06] border-white/10 text-white/55"
  };
  const sizes: Record<string, string> = {
    sm: "h-7 w-7 rounded-lg text-[10px]",
    md: "h-9 w-9 rounded-xl text-[11px]",
    lg: "h-11 w-11 rounded-2xl text-[12px]"
  };
  return (
    <span className={"inline-grid place-items-center border " + tones[tone] + " " + sizes[size]}>
      {children}
    </span>
  );
}

export function BizPanel({
  children,
  className = "",
  title,
  subtitle,
  action
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <section className={"biz-panel " + className}>
      {(title || action) && (
        <div className="biz-panel-head">
          <div>
            {title && <h2 className="biz-title">{title}</h2>}
            {subtitle && <p className="biz-subtitle">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function BizSection({
  number,
  title,
  subtitle,
  children,
  className = ""
}: {
  number?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={"biz-section " + className}>
      <div className="biz-section-head">
        <div>
          <div className="biz-section-kicker">{number ? number + ". " : ""}{title}</div>
          {subtitle && <p className="biz-section-subtitle">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export function BizStatus({ children, tone = "green" }: { children: ReactNode; tone?: "green" | "blue" | "orange" | "red" | "slate" }) {
  const map = {
    green: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    blue: "border-blue-400/20 bg-blue-400/10 text-blue-300",
    orange: "border-orange-400/20 bg-orange-400/10 text-orange-300",
    red: "border-rose-400/20 bg-rose-400/10 text-rose-300",
    slate: "border-white/10 bg-white/[.05] text-white/40"
  };
  return <span className={"biz-status " + map[tone]}><span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current align-middle" />{children}</span>;
}

export function BizMetric({
  label,
  value,
  delta,
  tone = "blue",
  icon
}: {
  label: string;
  value: string;
  delta?: string;
  tone?: "blue" | "purple" | "cyan" | "green" | "orange";
  icon?: ReactNode;
}) {
  return (
    <div className="biz-metric">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="biz-metric-label">{label}</p>
          <p className="biz-metric-value">{value}</p>
        </div>
        {icon && <BizIcon tone={tone} size="sm">{icon}</BizIcon>}
      </div>
      {delta && <p className="biz-metric-delta">{delta}</p>}
    </div>
  );
}

export function BizTabs({ items, active }: { items: string[]; active?: string }) {
  return (
    <div className="biz-tabs">
      {items.map((item, index) => (
        <span key={item} className={"biz-tab " + ((active && active === item) || (!active && index === 0) ? "biz-tab-active" : "")}>
          {item}
        </span>
      ))}
    </div>
  );
}

export function BizButton({
  children,
  variant = "primary",
  className = ""
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  const styles = {
    primary: "bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-[0_8px_28px_rgba(59,91,255,.26)]",
    secondary: "border border-white/10 bg-white/[.05] text-white/70 hover:bg-white/[.08]",
    ghost: "text-white/35 hover:bg-white/[.05] hover:text-white/70"
  };
  return <span className={"biz-button " + styles[variant] + " " + className}>{children}</span>;
}
