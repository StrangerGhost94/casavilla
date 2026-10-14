import { redirect } from "next/navigation";
import { preload } from "react-dom";
import { getUser, homeFor } from "@/lib/auth";
import { AppIntro } from "@/components/AppIntro";

// Where the installed app opens (manifest start_url): a short splash, then the marketplace.
// Landlords, managers, providers and caretakers go to their dashboard; tenants and visitors to the marketplace.
export const dynamic = "force-dynamic";
export const metadata = { title: "Welcome" };

export default async function AppStart() {
  const u = await getUser();
  if (u && u.role !== "tenant") redirect(homeFor(u.role));
  preload("/launch.jpg", { as: "image", fetchPriority: "high" });
  preload("/logo-light.png", { as: "image" });
  return <AppIntro />;
}
