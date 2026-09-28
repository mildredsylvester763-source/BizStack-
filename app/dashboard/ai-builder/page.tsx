// @ts-nocheck
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { runWebsiteBuild } from "@/lib/ai/build-engine/runtime";
import { runInvoiceBuild } from "@/lib/ai/build-engine/invoice-runtime";
import { runMoneyEntryBuild, runProductInventoryBuild } from "@/lib/ai/build-engine/operations-runtime";
import { runCustomerBuild } from "@/lib/ai/build-engine/customer-runtime";
import { runQuoteBuild } from "@/lib/ai/build-engine/quote-runtime";
import { runConnectorBuild } from "@/lib/ai/build-engine/connector-runtime";
import { runDualCurrencyBuild, runLoanReadinessBuild, runObligationBuild, runPayrollAdvanceBuild } from "@/lib/ai/build-engine/finance-ops-runtime";
import { runCashSaleBuild } from "@/lib/ai/build-engine/cash-sale-runtime";
import { runSupplierPriceBuild } from "@/lib/ai/build-engine/supplier-price-runtime";
import { runCommissionBuild } from "@/lib/ai/build-engine/commission-runtime";
import { runBusinessDocumentBuild } from "@/lib/ai/build-engine/business-document-runtime";
import { runSmsWalletBuild, runAppointmentBuild, runDigitalMenuBuild, runWaiverBuild } from "@/lib/ai/build-engine/customer-experience-runtime";
import { runThriftBuild, runBusinessCreditBuild, runSuccessorAccessBuild, runComplianceBuild } from "@/lib/ai/build-engine/continuity-runtime";

async function runBuild(formData: FormData) {
  "use server";
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!business) redirect("/onboarding");

  const capability = String(formData.get("capability") || "");
  const prompt = String(formData.get("prompt") || "").trim();
  if (!prompt) throw new Error("Describe the work you want BizStack to perform.");

  if (capability === "invoice") {
    await runInvoiceBuild({ businessId: business.id, userId: user.id, prompt, mode: "draft_only" });
  } else if (capability === "product_inventory") {
    await runProductInventoryBuild({ businessId: business.id, userId: user.id, prompt, mode: "auto_execute" });
  } else if (capability === "money_transaction") {
    await runMoneyEntryBuild({ businessId: business.id, userId: user.id, prompt, mode: "auto_execute" });
  } else if (capability === "customer") {
    await runCustomerBuild({ businessId: business.id, userId: user.id, prompt, mode: "auto_execute" });
  } else if (capability === "connector") {
    await runConnectorBuild({ businessId: business.id, userId: user.id, prompt, mode: "auto_execute" });
  } else if (capability === "quote") {
    await runQuoteBuild({ businessId: business.id, userId: user.id, prompt, mode: "draft_only" });
  } else if (capability === "dual_currency") {
    await runDualCurrencyBuild({ businessId: business.id, userId: user.id, prompt, mode: "auto_execute" });
  } else if (capability === "loan_readiness") {
    await runLoanReadinessBuild({ businessId: business.id, userId: user.id, prompt, mode: "draft_only" });
  } else if (capability === "obligation") {
    await runObligationBuild({ businessId: business.id, userId: user.id, prompt, mode: "auto_execute" });
  } else if (capability === "payroll_advance") {
    await runPayrollAdvanceBuild({ businessId: business.id, userId: user.id, prompt, mode: "auto_execute" });
  } else if (capability === "cash_sale") {
    await runCashSaleBuild({ businessId: business.id, userId: user.id, prompt, mode: "auto_execute" });
  } else if (capability === "supplier_price") {
    await runSupplierPriceBuild({ businessId: business.id, userId: user.id, prompt, mode: "auto_execute" });
  } else if (capability === "commission") {
    await runCommissionBuild({ businessId: business.id, userId: user.id, prompt, mode: "auto_execute" });
  } else if (capability === "business_plan") {
    await runBusinessDocumentBuild({ businessId: business.id, userId: user.id, prompt, mode: "draft_only" });
  } else if (capability === "sms_wallet") {
    await runSmsWalletBuild({ businessId: business.id, userId: user.id, prompt, mode: "ask_first" });
  } else if (capability === "appointment") {
    await runAppointmentBuild({ businessId: business.id, userId: user.id, prompt, mode: "auto_execute" });
  } else if (capability === "digital_menu") {
    await runDigitalMenuBuild({ businessId: business.id, userId: user.id, prompt, mode: "auto_execute" });
  } else if (capability === "waiver") {
    await runWaiverBuild({ businessId: business.id, userId: user.id, prompt, mode: "draft_only" });
  } else if (capability === "thrift_group") {
    await runThriftBuild({ businessId: business.id, userId: user.id, prompt, mode: "auto_execute" });
  } else if (capability === "business_credit") {
    await runBusinessCreditBuild({ businessId: business.id, userId: user.id, prompt, mode: "draft_only" });
  } else if (capability === "successor_access") {
    await runSuccessorAccessBuild({ businessId: business.id, userId: user.id, prompt, mode: "ask_first" });
  } else if (capability === "compliance") {
    await runComplianceBuild({ businessId: business.id, userId: user.id, prompt, mode: "auto_execute" });
  } else {
    await runWebsiteBuild({ businessId: business.id, userId: user.id, prompt, mode: "auto_execute", publish: false });
  }

  revalidatePath("/dashboard/ai-builder");
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/website");
  revalidatePath("/dashboard/quotes");
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/integrations");
}

export default async function AIBuilderPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id,name")
    .eq("owner_id", user.id)
    .single();

  if (!business) redirect("/onboarding");

  const { data: runs } = await supabase
    .from("ai_build_runs")
    .select("id,capability_key,status,provider_status,request_text,result,error_message,created_at")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .limit(16);

  const cards = [
    {
      capability: "website",
      eyebrow: "Website compiler",
      title: "Build a website from a description",
      description: "Sitemap, page models, sections, forms, SEO and integration requirements.",
      placeholder: "Build a modern website for my logistics company. Add services, tracking CTA, pricing, FAQ, contact form and WhatsApp. Make it mobile-first.",
      tone: "ink"
    },
    {
      capability: "invoice",
      eyebrow: "Invoice compiler",
      title: "Create a real draft invoice",
      description: "Matches an existing customer, parses billable lines, recalculates totals and validates the result.",
      placeholder: "Create an invoice for Acme Ltd for 2 logo design at 150000, due in 14 days, VAT 7.5%.",
      tone: "vault"
    },
    {
      capability: "product_inventory",
      eyebrow: "Product + inventory",
      title: "Create a product and opening stock",
      description: "Creates the real product, price, cost, low-stock threshold and audited opening stock movement.",
      placeholder: "Create product Premium Hoodie, SKU PH-001, price 25000, cost 14000, stock 20, low stock 5.",
      tone: "vault"
    },
    {
      capability: "money_transaction",
      eyebrow: "Money entry",
      title: "Record cash movement",
      description: "Records a real inflow or outflow with an optional matching financial account and reconciliation state.",
      placeholder: "Record an expense of ₦50000 for fuel from my Main Cash account.",
      tone: "ink"
    },
    {
      capability: "customer",
      eyebrow: "Customer CRM",
      title: "Create a real customer record",
      description: "Captures name and contact data, checks duplicates, then writes the customer into the CRM graph.",
      placeholder: "Create customer Acme Foods Ltd, email accounts@acmefoods.com, phone +2348012345678, country Nigeria, tags wholesale, priority.",
      tone: "ink"
    },
    {
      capability: "connector",
      eyebrow: "Universal Connector",
      title: "Compile an external API into BizStack",
      description: "Describe the API, authentication and resources. BizStack creates a draft connector definition without storing credentials in the build request.",
      placeholder: "Connect to Acme Shipping API at https://api.example.com using bearer token. Resources: orders GET /orders, shipments GET /shipments. Webhooks supported.",
      tone: "ink"
    },
    {
      capability: "quote",
      eyebrow: "Sales quote",
      title: "Build a real quote",
      description: "Matches an existing customer, parses commercial lines, calculates totals and saves a draft quote.",
      placeholder: "Create a quote for Acme Ltd for 2 website packages at 450000 each, VAT 7.5%, valid for 14 days, discount 5%.",
      tone: "vault"
    },
    {
      capability: "dual_currency",
      eyebrow: "Dual-currency books",
      title: "Configure foreign-currency bookkeeping",
      description: "Sets a real base currency plus enabled secondary currencies while preserving FX metadata.",
      placeholder: "Enable NGN as my base currency and USD, GBP as secondary books.",
      tone: "ink"
    },
    {
      capability: "cash_sale",
      eyebrow: "Cash register",
      title: "Record a market-style cash sale",
      description: "Checks the real open register, resolves products, checks stock, records the sale and updates inventory.",
      placeholder: "Cash sale 2 Premium Hoodie at 25000, cash received 60000.",
      tone: "ink"
    },
    {
      capability: "supplier_price",
      eyebrow: "Supplier intelligence",
      title: "Record a supplier price change",
      description: "Updates the real supplier-product cost history and produces a thresholded alert.",
      placeholder: "Supplier Acme Wholesale raised Premium Hoodie cost to 16500 NGN.",
      tone: "vault"
    },
    {
      capability: "commission",
      eyebrow: "Agent commissions",
      title: "Calculate an invoice commission",
      description: "Links a real invoice and sales agent to a payable commission ledger.",
      placeholder: "Calculate 7.5% commission for John Agent on invoice INV-0003.",
      tone: "ink"
    },
    {
      capability: "business_plan",
      eyebrow: "Business documents",
      title: "Draft a business plan or grant pack",
      description: "Builds structured sections from the business graph with explicit assumptions and evidence boundaries.",
      placeholder: "Create a grant application draft for a ₦5000000 expansion project focused on jobs, digital operations and revenue growth.",
      tone: "vault"
    },
    {
      capability: "sms_wallet",
      eyebrow: "SMS credit wallet",
      title: "Initialize SMS credits",
      description: "Creates the real business SMS wallet and low-balance threshold without pretending external payment credits were purchased.",
      placeholder: "Set up my SMS wallet in NGN with a low-balance alert at 100 credits.",
      tone: "ink"
    },
    {
      capability: "appointment",
      eyebrow: "Bookings + deposits",
      title: "Book a real appointment",
      description: "Matches the customer, creates the service when needed, checks time collisions and records a deposit requirement.",
      placeholder: "Book an appointment for John Doe for Hair Consultation at 2026-10-05T14:30 for 60 minutes, price 25000, deposit 30%.",
      tone: "vault"
    },
    {
      capability: "digital_menu",
      eyebrow: "QR menu + kitchen flow",
      title: "Create a digital menu",
      description: "Creates a real QR-ready menu, menu items and optional kitchen-flow configuration.",
      placeholder: "Create menu Evening Menu, currency NGN, items: Jollof Rice at 5000, Grilled Chicken at 8000, Fresh Juice at 3000.",
      tone: "ink"
    },
    {
      capability: "waiver",
      eyebrow: "Digital waiver",
      title: "Draft a customer waiver",
      description: "Creates a versioned waiver ready for typed, drawn or external signature capture.",
      placeholder: "Create a waiver called Photography Consent. Title: Event photography consent. Body: Customers consent to photography and defined usage terms.",
      tone: "vault"
    },
    {
      capability: "thrift_group",
      eyebrow: "Ajo / Esusu / thrift",
      title: "Create a savings group",
      description: "Creates the real group rules and contribution boundary without claiming member payments.",
      placeholder: "Create Ajo Group Alpha, contribution 50000 NGN monthly, rotating payout, next 2026-10-01.",
      tone: "ink"
    },
    {
      capability: "business_credit",
      eyebrow: "Business credit",
      title: "Build a documented credit profile",
      description: "Calculates a transparent internal credit profile from recorded invoices and posted cashflow evidence.",
      placeholder: "Calculate my business credit profile and show what evidence I still need to strengthen it.",
      tone: "vault"
    },
    {
      capability: "successor_access",
      eyebrow: "Emergency continuity",
      title: "Draft successor access",
      description: "Creates a delayed, explicit emergency-access grant without generating immediate privileged credentials.",
      placeholder: "Create successor access for jane@example.com with 48 hour activation delay and permissions view_business, financial_reports, customer_records.",
      tone: "ink"
    },
    {
      capability: "compliance",
      eyebrow: "Compliance calendar",
      title: "Add a compliance obligation",
      description: "Creates a due-date, jurisdiction, priority and evidence-tracking record.",
      placeholder: "Create compliance item Annual Tax Filing, authority FIRS, jurisdiction Nigeria, due 2026-12-31, priority high.",
      tone: "vault"
    },
    {
      capability: "loan_readiness",
      eyebrow: "Financing readiness",
      title: "Build a lender-ready profile",
      description: "Scores documented financial readiness and produces a lender-pack checklist without inventing evidence.",
      placeholder: "Assess loan readiness for ₦5000000 over 24 months to expand inventory.",
      tone: "vault"
    },
    {
      capability: "obligation",
      eyebrow: "Scheduled obligations",
      title: "Schedule rent, utilities or operating costs",
      description: "Creates a real recurring obligation with amount, currency, frequency and due date tracking.",
      placeholder: "Schedule monthly rent of ₦300000 to Green Estate, due 2026-10-05.",
      tone: "ink"
    },
    {
      capability: "payroll_advance",
      eyebrow: "Payroll advances",
      title: "Create a staff salary advance",
      description: "Matches a real workforce member and records a recoverable advance with payroll deduction terms.",
      placeholder: "Give salary advance to John Doe of ₦150000, recover over 3 months, start 2026-10-01.",
      tone: "vault"
    }
    ,{
      capability: "cash_sale",
      eyebrow: "Cash register",
      title: "Record a market-style cash sale",
      description: "Resolves real products, checks stock, records the sale, decrements inventory and updates the open register.",
      placeholder: "Cash sale 2 Premium Hoodie at 25000, cash received 60000.",
      tone: "ink"
    }
  ];

  return (
    <main className="min-h-screen bg-ledger">
      <header className="border-b border-rule bg-white">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <Link href="/dashboard" className="text-xs text-ink/45">← Dashboard</Link>
            <h1 className="font-display text-2xl mt-1">BizStack Build Engine</h1>
          </div>
          <span className="text-xs text-ink/45">{business.name}</span>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-10">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[.16em] text-vault">Business operating compiler</p>
          <h2 className="font-display text-4xl mt-2">Tell BizStack what work needs to happen.</h2>
          <p className="text-sm text-ink/55 mt-3">
            Each request becomes a durable run with a plan, executable steps, artifacts,
            validation tests, provider state and an audit event. Core workflows do not depend on an external AI key.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mt-8">
          {cards.map((card) => (
            <form key={card.capability} action={runBuild} className="bg-white border border-rule p-6">
              <input type="hidden" name="capability" value={card.capability} />
              <p className="text-xs uppercase tracking-[.16em] text-vault">{card.eyebrow}</p>
              <h3 className="font-display text-2xl mt-2">{card.title}</h3>
              <p className="text-sm text-ink/50 mt-2">{card.description}</p>
              <textarea
                name="prompt"
                required
                rows={7}
                className="mt-5 w-full border border-rule px-4 py-3 text-sm"
                placeholder={card.placeholder}
              />
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-[11px] uppercase tracking-[.12em] text-ink/35">{card.capability.replaceAll("_", " ")}</span>
                <button
                  className={card.tone === "vault" ? "bg-vault text-white px-5 py-3 text-sm" : "bg-ink text-white px-5 py-3 text-sm"}
                >
                  Run build
                </button>
              </div>
            </form>
          ))}
        </div>

        <div className="mt-10 bg-white border border-rule">
          <div className="p-5 border-b border-rule">
            <p className="text-xs uppercase tracking-[.16em] text-vault">Build ledger</p>
            <h3 className="font-display text-xl mt-1">Recent execution history</h3>
          </div>
          <div className="divide-y divide-rule">
            {(runs ?? []).map((run) => (
              <div key={run.id} className="p-5 grid md:grid-cols-[150px_1fr_110px_170px] gap-4 items-start">
                <div className="text-xs uppercase text-vault">{run.capability_key}</div>
                <div>
                  <p className="text-sm text-ink">{run.request_text}</p>
                  {run.error_message && <p className="text-xs text-alert mt-2">{run.error_message}</p>}
                  {run.result?.invoiceNumber && <p className="text-xs text-ink/45 mt-2">Invoice {run.result.invoiceNumber} · {run.result.currency} {run.result.total}</p>}
                  {run.result?.metrics && <p className="text-xs text-ink/45 mt-2">{run.result.metrics.pages} pages · {run.result.metrics.sections} sections</p>}
                  {run.result?.product && <p className="text-xs text-ink/45 mt-2">Product {run.result.product.name} · stock {run.result.product.stock_quantity}</p>}
                  {run.result?.transaction && <p className="text-xs text-ink/45 mt-2">{run.result.transaction.direction} · {run.result.transaction.amount} {run.result.transaction.currency}</p>}
                  {run.result?.customer && <p className="text-xs text-ink/45 mt-2">Customer {run.result.customer.name} · {run.result.customer.customer_type}</p>}
                  {run.result?.connector && <p className="text-xs text-ink/45 mt-2">Connector {run.result.connector.name} · {run.result.connector.schema_definition?.resources?.length || 0} resources · credentials required</p>}
                  {run.result?.quoteNumber && <p className="text-xs text-ink/45 mt-2">Quote {run.result.quoteNumber} · {run.result.currency} {run.result.total}</p>}
                  {run.result?.alert && <p className="text-xs text-alert mt-2">Supplier price alert created: +{Number(run.result.alert.change_percent || 0).toFixed(2)}%</p>}
                  {run.result?.commission && <p className="text-xs text-vault mt-2">Commission {Number(run.result.commission.commission_amount || 0).toLocaleString()} {run.result.commission.currency} · {Number(run.result.commission.rate_percent || 0).toFixed(2)}%</p>}
                </div>
                <div className="text-xs capitalize text-ink/60">{String(run.status).replace("_", " ")}</div>
                <div className="text-xs text-ink/40 md:text-right">{new Date(run.created_at).toLocaleString()}</div>
              </div>
            ))}
            {!(runs ?? []).length && <p className="p-5 text-sm text-ink/45">No build runs yet.</p>}
          </div>
        </div>
      </section>
    </main>
  );
}
