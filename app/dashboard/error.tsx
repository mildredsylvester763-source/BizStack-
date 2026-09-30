"use client";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="biz-route-error"><span className="biz-error-mark">△</span><p className="biz-kicker">BIZSTACK / RECOVERY</p><h1>This operating surface is unavailable.</h1><p>The workspace could not load this route. Your data has not been changed.</p><div><button className="biz-primary-button" onClick={() => reset()}>Retry surface</button><a className="biz-panel-link" href="/dashboard">Return to home →</a></div></div>;
}
