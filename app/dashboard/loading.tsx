export default function DashboardLoading() {
  return <div className="biz-route-loading" aria-label="Loading BizStack">
    <div className="biz-loading-head"><span className="biz-skeleton short" /><span className="biz-skeleton medium" /></div>
    <div className="biz-loading-grid">{Array.from({ length: 6 }).map((_, index) => <div className="biz-loading-panel" key={index}><span className="biz-skeleton title" /><span className="biz-skeleton line" /><span className="biz-skeleton line narrow" /><span className="biz-skeleton block" /></div>)}</div>
  </div>;
}
