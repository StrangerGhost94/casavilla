import { redirect } from "next/navigation";

// Landlords only view their money and tenants; the CasaVilla office does this work for them.
export default function Page() {
  redirect("/landlord");
}
