import { redirect } from "next/navigation";

// CasaVilla uses email only for codes and receipts; WhatsApp / SMS isn't used.
export default function Page() {
  redirect("/manager/health");
}
