import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { BizIcon, BizPanel, BizSection, BizStatus, BizTabs } from "@/components/ui/BizStackVisual";

async function createListing(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id,currency").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");

  const { error } = await supabase.from("marketplace_listings").insert({
    seller_business_id: business.id,
    title: String(formData.get("title") || "").trim(),
    description: String(formData.get("description") || "").trim(),
    listing_type: String(formData.get("listingType") || "service"),
    category: String(formData.get("category") || "general"),
    price: formData.get("price") ? Number(formData.get("price")) : null,
    currency: String(formData.get("currency") || business.currency || "USD"),
    quantity_available: formData.get("quantity") ? Number(formData.get("quantity")) : null,
    status: "draft",
    tags: String(formData.get("tags") || "").split(",").map(v => v.trim()).filter(Boolean),
    created_by: user.id
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/marketplace");
}

async function publishListing(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");
  await supabase.from("marketplace_listings").update({ status: "published", updated_at: new Date().toISOString() })
    .eq("id", String(formData.get("id") || "")).eq("seller_business_id", business.id);
  revalidatePath("/dashboard/marketplace");
}

async function inquire(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");
  const id = String(formData.get("listingId") || "");
  const { data: listing } = await supabase.from("marketplace_listings").select("id,seller_business_id,status").eq("id", id).eq("status", "published").single();
  if (!listing || listing.seller_business_id === business.id) throw new Error("Listing unavailable for inquiry.");
  await supabase.from("marketplace_inquiries").insert({
    listing_id: id,
    buyer_business_id: business.id,
    message: String(formData.get("message") || "").trim(),
    requested_quantity: formData.get("quantity") ? Number(formData.get("quantity")) : null,
    offer_amount: formData.get("offer") ? Number(formData.get("offer")) : null,
    currency: formData.get("currency") || null
  });
  revalidatePath("/dashboard/marketplace");
}

export default async function MarketplacePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id,name,currency").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");

  const [{ data: mine }, { data: listings }, { data: inquiries }] = await Promise.all([
    supabase.from("marketplace_listings").select("id,title,description,listing_type,category,price,currency,quantity_available,status,tags,created_at").eq("seller_business_id", business.id).order("created_at",{ascending:false}),
    supabase.from("marketplace_listings").select("id,title,description,listing_type,category,price,currency,quantity_available,seller_business_id,tags,created_at,seller:businesses(name)").eq("status","published").neq("seller_business_id",business.id).order("created_at",{ascending:false}).limit(50),
    supabase.from("marketplace_inquiries").select("id,listing_id,buyer_business_id,message,status,created_at,listing:marketplace_listings(title)").or("buyer_business_id.eq."+business.id).limit(50)
  ]);

  return <div className="biz-content">
    <BizSection number="3.5" title="AI Tools Marketplace" subtitle="Business tools, services and extensions that make the BizStack workspace more capable.">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <BizTabs items={["AI Tools","Productivity","Design","Development","Marketing","Business"]}/>
        <Link href="/dashboard/ai-builder"><span className="biz-button bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white">Open AI Builder</span></Link>
      </div>

      <div className="grid xl:grid-cols-[1fr_330px] gap-3">
        <BizPanel title="Discover" subtitle="Published tools and business offerings from connected workspaces.">
          <div className="p-3">
            <div className="flex items-center gap-2 rounded-xl border border-white/[.07] bg-white/[.025] px-3 py-2.5 mb-3">
              <span className="text-[10px] text-white/20">⌕</span><input placeholder="Search AI tools, services or business offerings…" className="flex-1 bg-transparent outline-none text-[8px] text-white/65 placeholder:text-white/20"/><span className="biz-chip">{(listings||[]).length} live</span>
            </div>
            <div className="grid md:grid-cols-2 gap-2">
              {(listings||[]).map((l:any)=>(
                <article key={l.id} className="rounded-2xl border border-blue-400/10 bg-white/[.02] p-4 hover:border-blue-400/25 transition">
                  <div className="flex items-start gap-3">
                    <BizIcon tone={l.listing_type==="service"?"purple":l.listing_type==="product"?"green":"blue"} size="lg">{String(l.title||"T").slice(0,1).toUpperCase()}</BizIcon>
                    <div className="min-w-0 flex-1">
                      <div className="flex gap-2 items-center flex-wrap"><span className="text-[9px] font-semibold text-white/70">{l.title}</span><BizStatus tone="green">Published</BizStatus></div>
                      <div className="text-[7px] text-white/20 mt-1 capitalize">{l.listing_type} · {l.category} · {l.seller?.name||"Business"}</div>
                    </div>
                  </div>
                  <p className="mt-3 text-[8px] leading-4 text-white/30 line-clamp-3">{l.description||"No description supplied."}</p>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div><div className="text-[7px] text-white/20">Price</div><div className="text-[10px] font-semibold text-white/70">{l.price!=null?String(l.currency||"")+" "+Number(l.price).toLocaleString():"Contact seller"}</div></div>
                    <form action={inquire} className="flex gap-1.5"><input type="hidden" name="listingId" value={l.id}/><input type="hidden" name="currency" value={l.currency||business.currency}/><input name="message" required placeholder="Inquiry…" className="w-24 rounded-lg border border-white/[.07] bg-white/[.025] px-2 py-1.5 text-[7px] text-white"/><button className="rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-2.5 py-1.5 text-[7px] text-white">Send</button></form>
                  </div>
                </article>
              ))}
            </div>
            {!(listings||[]).length&&<div className="p-8 text-center text-[9px] text-white/25">No published listings yet.</div>}
          </div>
        </BizPanel>

        <div className="space-y-3">
          <BizPanel title="Create a listing" subtitle="Publish a real offering for other businesses.">
            <form action={createListing} className="p-4 space-y-2.5">
              <input name="title" required placeholder="Listing title" className="w-full rounded-xl border border-white/[.08] bg-white/[.025] px-3 py-2.5 text-[8px] text-white"/>
              <textarea name="description" rows={4} placeholder="Description, delivery scope, terms" className="w-full rounded-xl border border-white/[.08] bg-white/[.025] px-3 py-2.5 text-[8px] text-white"/>
              <div className="grid grid-cols-2 gap-2"><select name="listingType" className="rounded-xl border border-white/[.08] bg-white/[.025] px-2.5 py-2.5 text-[8px] text-white"><option>service</option><option>product</option><option>wholesale</option><option>partnership</option><option>procurement</option></select><input name="category" placeholder="Category" className="rounded-xl border border-white/[.08] bg-white/[.025] px-2.5 py-2.5 text-[8px] text-white"/></div>
              <div className="grid grid-cols-2 gap-2"><input name="price" type="number" step="0.01" placeholder="Price" className="rounded-xl border border-white/[.08] bg-white/[.025] px-2.5 py-2.5 text-[8px] text-white"/><input name="currency" defaultValue={business.currency||"USD"} className="rounded-xl border border-white/[.08] bg-white/[.025] px-2.5 py-2.5 text-[8px] text-white"/></div>
              <button className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 py-2.5 text-[8px] font-semibold text-white">Save draft</button>
            </form>
          </BizPanel>

          <BizPanel title="Your listings" subtitle="Drafts and published offerings.">
            <div>
              {(mine||[]).length===0?<div className="p-5 text-[9px] text-white/25">No listings yet.</div>:(mine||[]).map((l:any)=><div key={l.id} className="biz-list-row"><BizIcon tone={l.status==="published"?"green":"slate"} size="sm">◆</BizIcon><div className="min-w-0 flex-1"><div className="text-[8px] text-white/60 truncate">{l.title}</div><div className="text-[7px] text-white/20 mt-1">{l.status} · {l.listing_type}</div></div>{l.status==="draft"&&<form action={publishListing}><input type="hidden" name="id" value={l.id}/><button className="text-[7px] text-blue-300">Publish</button></form>}</div>)}
            </div>
          </BizPanel>

          <BizPanel title="Inquiries" subtitle="Buyer conversations on your listings.">
            <div className="p-3">{(inquiries||[]).length===0?<div className="text-[9px] text-white/25">No inquiries yet.</div>:(inquiries||[]).slice(0,6).map((x:any)=><div key={x.id} className="rounded-xl border border-white/[.06] bg-white/[.02] p-3 mb-2"><div className="text-[8px] text-white/60">{x.listing?.title||"Listing"}</div><div className="text-[7px] text-white/22 mt-1 line-clamp-2">{x.message}</div></div>)}</div>
          </BizPanel>
        </div>
      </div>
    </BizSection>
  </div>;
}
