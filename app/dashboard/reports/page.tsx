"use client";
import { useState } from "react";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul"];
const REV   = [180,140,300,200,280,160,240];
const EXP   = [90, 80, 160,110,140,90, 130];
const MAX   = Math.max(...REV);

function toPath(data: number[], w: number, h: number) {
  const pts = data.map((v,i) => `${(i/(data.length-1))*w},${h-(v/MAX)*h}`);
  return pts.join(" ");
}

const DONUT = [
  { label:"Invoices",     pct:45, color:"#5B6EF5" },
  { label:"Services",     pct:25, color:"#8B5CF6" },
  { label:"Subscriptions",pct:20, color:"#22C55E" },
  { label:"Other",        pct:10, color:"#F5A524" },
];

function DonutChart() {
  const r = 60, cx = 80, cy = 80, circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg viewBox="0 0 160 160" className="w-32 h-32">
      {DONUT.map((d) => {
        const dash = (d.pct / 100) * circ;
        const gap  = circ - dash;
        const el = (
          <circle key={d.label} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth="20"
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset}
            style={{transform:"rotate(-90deg)",transformOrigin:`${cx}px ${cy}px`}}
          />
        );
        offset += dash;
        return el;
      })}
      <text x={cx} y={cy+4} textAnchor="middle" fill="white" fontSize="13" fontWeight="bold">$24.5K</text>
    </svg>
  );
}

export default function ReportsPage() {
  const [tab, setTab] = useState("Overview");
  const TABS = ["Overview","Invoices","Customers","Products","Marketing"];

  return (
    <div className="min-h-screen p-5 lg:p-6 relative">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-white">Reports &amp; Analytics</h1>
          <p className="text-sm text-textMuted mt-0.5">Make better decisions with real-time insights.</p>
        </div>
        <select className="bg-[#0b1220]/90 border border-white/[.065] text-textMuted text-sm rounded-lg px-3 py-2 focus:outline-none"><option>This Month</option><option>Last Month</option><option>Last Quarter</option></select>
      </div>

      <div className="flex gap-1 mb-6 bg-[#0b1220]/90 border border-white/[.065] rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${tab===t?"text-white":"text-textMuted hover:text-white"}`}
            style={tab===t?{background:"#5B6EF5"}:{}}>{t}</button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label:"Revenue",    value:"$24,580", trend:"+12%",  color:"#22C55E" },
          { label:"Expenses",   value:"$8,340",  trend:"-",     color:"#8B92B0" },
          { label:"Net Profit", value:"$16,240", trend:"+19%",  color:"#5B6EF5" },
        ].map(s => (
          <div key={s.label} className="bg-[#0b1220]/90 border border-white/[.065] rounded-xl p-5">
            <p className="text-xs text-textMuted mb-1">{s.label}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold text-white">{s.value}</p>
              {s.trend !== "-" && <span className="text-xs" style={{color:s.color}}>{s.trend}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-[#0b1220]/90 border border-white/[.065] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Revenue vs Expenses</h2>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-textMuted"><span className="w-2 h-2 rounded-full inline-block bg-indigo-500"/> Revenue</span>
              <span className="flex items-center gap-1.5 text-textMuted"><span className="w-2 h-2 rounded-full inline-block bg-violet-500"/> Expenses</span>
            </div>
          </div>
          <svg viewBox="0 0 420 100" className="w-full h-28">
            <defs>
              <linearGradient id="rrg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5B6EF5" stopOpacity="0.3"/><stop offset="100%" stopColor="#5B6EF5" stopOpacity="0"/></linearGradient>
              <linearGradient id="eeg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.2"/><stop offset="100%" stopColor="#8B5CF6" stopOpacity="0"/></linearGradient>
            </defs>
            {[25,50,75].map(y => <line key={y} x1="0" y1={y} x2="420" y2={y} stroke="#232B4D" strokeWidth="1"/>)}
            <polygon points={`0,100 ${toPath(REV,420,100)} 420,100`} fill="url(#rrg)"/>
            <polyline points={toPath(REV,420,100)} fill="none" stroke="#5B6EF5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <polygon points={`0,100 ${toPath(EXP,420,100)} 420,100`} fill="url(#eeg)"/>
            <polyline points={toPath(EXP,420,100)} fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            {MONTHS.map((m,i) => <text key={m} x={(i/(MONTHS.length-1))*420} y="99" fill="#8B92B0" fontSize="9" textAnchor="middle">{m}</text>)}
          </svg>
        </div>

        <div className="bg-[#0b1220]/90 border border-white/[.065] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Revenue by Source</h2>
          <div className="flex items-center gap-4">
            <DonutChart />
            <div className="space-y-2">
              {DONUT.map(d => (
                <div key={d.label} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{background:d.color}}/>
                  <span className="text-xs text-textMuted">{d.label}</span>
                  <span className="text-xs font-medium text-white ml-auto">{d.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
