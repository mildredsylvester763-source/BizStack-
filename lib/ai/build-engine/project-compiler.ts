import type { WebsiteSpec, WebsitePageSpec } from "@/lib/ai/build-engine/types";

type ProjectFile = { path: string; content: string; language: string };

function pageComponent(page: WebsitePageSpec) {
  return (
    'import { SitePage } from "@/components/site-page";\n' +
    "const page = " + JSON.stringify(page) + ";\n" +
    "export default function Page(){ return <SitePage page={page} />; }\n"
  );
}

function sitePageComponent() {
  return [
    '"use client";',
    'import Link from "next/link";',
    "type Section={id:string;type:string;heading?:string;body?:string;items?:Array<Record<string,unknown>>;button?:string;url?:string};",
    "type Page={title:string;seo:{title:string;description:string};sections:Section[]};",
    "function SectionView({section}:{section:Section}){",
    " const items=section.items||[];",
    ' if(section.type==="hero") return <section className="hero"><div><span className="eyebrow">BUILT WITH BIZSTACK</span><h1>{section.heading||"Your business, presented beautifully."}</h1><p>{section.body}</p>{section.button&&<Link className="button" href={section.url||"#contact"}>{section.button}</Link>}</div></section>;',
    ' if(section.type==="contact") return <section id="contact" className="section contact"><div><span className="eyebrow">CONTACT</span><h2>{section.heading||"Lets work together."}</h2><p>{section.body}</p></div><form onSubmit={(e)=>e.preventDefault()}><input required placeholder="Your name"/><input required type="email" placeholder="Email address"/><textarea required placeholder="How can we help?"/><button className="button" type="submit">Send enquiry</button></form></section>;',
    ' if(["services","products","features","testimonials","faq","gallery"].includes(section.type)) return <section className="section"><span className="eyebrow">{section.type.toUpperCase()}</span><h2>{section.heading||section.type}</h2>{section.body&&<p className="lead">{section.body}</p>}<div className="grid">{items.map((item,i)=><article className="item" key={i}><h3>{String(item.title||item.name||item.question||item.heading||"")}</h3><p>{String(item.description||item.body||item.answer||item.text||"")}</p>{item.price&&<strong>{String(item.price)}</strong>}</article>)}</div></section>;',
    ' return <section className="section"><span className="eyebrow">{section.type.toUpperCase()}</span><h2>{section.heading}</h2><p className="lead">{section.body}</p>{section.button&&<Link className="button" href={section.url||"#"}>{section.button}</Link>}</section>;',
    "}",
    "export function SitePage({page}:{page:Page}){return <main>{page.sections.map(s=><SectionView section={s} key={s.id}/>)}</main>}",
  ].join("\n");
}

function globals(spec: WebsiteSpec) {
  const primary = spec.theme.primary || "#111827";
  const accent = spec.theme.accent || "#d97706";
  const surface = spec.theme.surface || "#f8fafc";
  return ":root{--primary:" + primary + ";--accent:" + accent + ";--surface:" + surface + ";--text:#111827;--muted:#64748b}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--surface);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,sans-serif}a{text-decoration:none;color:inherit}.hero{min-height:72vh;display:grid;place-items:center;padding:72px 6vw;background:linear-gradient(135deg,var(--primary),#0f172a);color:white}.hero>div{max-width:900px}.eyebrow{font-size:.72rem;letter-spacing:.18em;font-weight:800;color:var(--accent)}h1{font-size:clamp(3rem,8vw,7rem);line-height:.95;margin:18px 0}h2{font-size:clamp(2rem,4vw,4rem);line-height:1;margin:12px 0 20px}.lead,.hero p{font-size:1.15rem;line-height:1.8;max-width:760px;color:var(--muted)}.hero p{color:#dbeafe}.section{padding:90px 6vw;max-width:1280px;margin:auto}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px;margin-top:32px}.item{background:white;border:1px solid #e2e8f0;border-radius:24px;padding:28px;min-height:160px;box-shadow:0 10px 35px rgba(15,23,42,.06)}.item p{color:var(--muted);line-height:1.7}.button{display:inline-flex;align-items:center;justify-content:center;margin-top:24px;padding:14px 20px;border-radius:999px;background:var(--accent);color:white;font-weight:800;border:0;cursor:pointer}.contact{display:grid;grid-template-columns:1fr 1fr;gap:48px}.contact form{display:grid;gap:14px}.contact input,.contact textarea{width:100%;padding:16px;border:1px solid #cbd5e1;border-radius:14px;font:inherit}.contact textarea{min-height:150px}@media(max-width:760px){.contact{grid-template-columns:1fr}.hero{min-height:62vh}.section{padding:64px 5vw}}";
}

export function compileWebsiteToProject(spec: WebsiteSpec) {
  const files: ProjectFile[] = [
    {
      path: "package.json",
      language: "json",
      content: JSON.stringify(
        {
          name: spec.subdomain || "bizstack-site",
          private: true,
          scripts: { dev: "next dev", build: "next build", start: "next start" },
          dependencies: { next: "16.3.6", react: "19.2.6", "react-dom": "19.2.6" },
          devDependencies: {
            "@types/node": "^20.14.0",
            "@types/react": "^19.0.0",
            "@types/react-dom": "^19.0.0",
            typescript: "^5.5.3"
          },
          engines: { node: "20.9.x || >=21.0.0" }
        },
        null,
        2
      )
    },
    {
      path: "tsconfig.json",
      language: "json",
      content: JSON.stringify(
        {
          compilerOptions: {
            target: "es5",
            lib: ["dom", "dom.iterable", "esnext"],
            allowJs: false,
            skipLibCheck: true,
            strict: true,
            noEmit: true,
            esModuleInterop: true,
            module: "esnext",
            moduleResolution: "bundler",
            resolveJsonModule: true,
            isolatedModules: true,
            jsx: "preserve",
            incremental: true,
            plugins: [{ name: "next" }]
          },
          include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
          exclude: ["node_modules"]
        },
        null,
        2
      )
    },
    {
      path: "next-env.d.ts",
      language: "typescript",
      content: '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n'
    },
    {
      path: "next.config.mjs",
      language: "javascript",
      content: "const nextConfig={reactStrictMode:true};\nexport default nextConfig;\n"
    },
    { path: "app/globals.css", language: "css", content: globals(spec) },
    { path: "components/site-page.tsx", language: "tsx", content: sitePageComponent() },
    {
      path: "app/layout.tsx",
      language: "tsx",
      content:
        'import "./globals.css";\n' +
        "export const metadata=" +
        JSON.stringify({ title: spec.seo.siteTitle, description: spec.seo.description }) +
        ";\n" +
        "export default function RootLayout({children}:{children:React.ReactNode}){return <html lang=\"en\"><body>{children}</body></html>}\n"
    }
  ];

  for (const page of spec.pages) {
    const route = page.slug === "home" ? "app/page.tsx" : "app/" + page.slug + "/page.tsx";
    files.push({ path: route, language: "tsx", content: pageComponent(page) });
  }

  return files;
}
