import { ServicesTop } from "@/components/ServicesTop";
import { CardsSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <main>
      <ServicesTop />
      <CardsSkeleton />
    </main>
  );
}
