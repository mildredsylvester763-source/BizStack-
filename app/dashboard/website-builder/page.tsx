import { redirect } from "next/navigation";

export default function LegacyWebsiteBuilderRedirect() {
  redirect("/dashboard/ai-builder");
}
