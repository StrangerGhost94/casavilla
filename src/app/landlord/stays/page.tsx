import { requireUser } from "@/lib/auth";
import { HostStays } from "@/components/HostStays";

export const metadata = { title: "Short stays" };
export default async function LandlordStays() { const u = await requireUser("landlord"); return <HostStays landlordId={u.id} />; }
