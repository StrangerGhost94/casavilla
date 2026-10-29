import {
  Bug, Building2, DraftingCompass, Hammer, HardHat, MoreHorizontal, PaintRoller, ShieldCheck, Sofa, Sparkles, Sprout, Truck, Wrench, Zap,
  type LucideIcon,
} from "lucide-react";

/** Icon for each service / repair category (see SERVICE_CATEGORIES). */
export const categoryIcon: Record<string, LucideIcon> = {
  Cleaning: Sparkles,
  Plumbing: Wrench,
  Electrical: Zap,
  Structural: Building2,
  "Pest control": Bug,
  Carpentry: Hammer,
  Painting: PaintRoller,
  Security: ShieldCheck,
  Gardening: Sprout,
  Moving: Truck,
  Other: MoreHorizontal,
  Construction: HardHat,
  "Interior design": Sofa,
  "House plans": DraftingCompass,
};

/** Friendly plural labels for the services grid. */
export const categoryLabel: Record<string, string> = {
  Cleaning: "Cleaners", Plumbing: "Plumbers", Electrical: "Electricians", Structural: "Builders",
  "Pest control": "Pest control", Carpentry: "Carpenters", Painting: "Painters", Security: "Security",
  Gardening: "Gardeners", Moving: "Movers", Other: "More",
  Construction: "New builds", "Interior design": "Interiors", "House plans": "House plans",
};

export function CategoryIcon({ category, className = "h-5 w-5" }: { category: string; className?: string }) {
  const I = categoryIcon[category] ?? MoreHorizontal;
  return <I className={className} />;
}
