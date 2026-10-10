import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { NewPropertyForm } from "@/components/Portfolio";
import { AddChoice } from "@/components/AddChoice";

export default async function NewProperty() {
  await requireUser("landlord");
  return <div className="max-w-2xl"><PageHeader title="Add a property" subtitle="Three quick steps — then photos." /><AddChoice role="landlord" active="rent" /><NewPropertyForm /></div>;
}
