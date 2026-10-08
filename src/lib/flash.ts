import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Stop a server action with a message the person can read: sends them back to the page they were on
 * with ?error=… which <Flash/> shows as a banner. (Throwing would show a blank error page in production.)
 */
export async function fail(message: string): Promise<never> {
  const ref = (await headers()).get("referer");
  let back = "/";
  try {
    const u = new URL(ref || "");
    u.searchParams.delete("ok");
    u.searchParams.set("error", message);
    back = u.pathname + u.search;
  } catch { /* no referer: go home */ }
  redirect(back);
}
