import { requireUser } from "@/lib/auth";
import { RequestDetail } from "@/components/BuildAdmin";

export const metadata = { title: "Build request" };

export default async function BuildRequestPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("manager");
  return <RequestDetail id={Number((await params).id) || 0} />;
}
