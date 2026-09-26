"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

export async function createCustomer(
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!name) {
    return { error: "Customer name is required." };
  }

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!business) {
    redirect("/onboarding");
  }

  const { error } = await supabase.from("customers").insert({
    business_id: business.id,
    name,
    email: email || null,
    phone: phone || null
  });

  if (error) {
    return { error: "Unable to add this customer: " + error.message };
  }

  revalidatePath("/dashboard/customers");
  return { success: true };
}
