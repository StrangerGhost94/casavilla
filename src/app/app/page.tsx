import { redirect } from "next/navigation";
import { preload } from "react-dom";
import { getUser, homeFor } from "@/lib/auth";
import { AppIntro } from "@/components/AppIntro";

// Where the installed app opens (manifest start_url). Signed-in people go straight to their dashboard.
export const dynamic = "force-dynamic";
export const metadata = { title: "Welcome" };

export default async function AppStart() {
  const u = await getUser();
  if (u) redirect(homeFor(u.role));
  preload("/launch.jpg", { as: "image", fetchPriority: "high" });
  preload("/logo-light.png", { as: "image" });
  return <AppIntro />;
}
