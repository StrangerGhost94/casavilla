import { requireUser } from "@/lib/auth";
import { HostStays } from "@/components/HostStays";

export const metadata = { title: "Short stays" };
export default async function ManagerStays() { await requireUser("manager"); return <HostStays />; }
