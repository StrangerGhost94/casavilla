import { redirect } from "next/navigation";

// CasaVilla's finance department pays landlords outside the app.
export default function Page() {
  redirect("/landlord/statements");
}
