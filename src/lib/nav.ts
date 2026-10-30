// Navigation for each kind of account. Icons are lucide names, resolved in NavIcons.tsx.
export type Role = "tenant" | "landlord" | "provider" | "manager" | "caretaker";
export type NavItem = { href: string; label: string; icon: string; group?: string };

export const roleName: Record<Role, string> = {
  tenant: "Tenant", landlord: "Landlord", provider: "Service provider", manager: "Property manager", caretaker: "Caretaker",
};

// Long menus are split into labelled groups (`group` starts a new section; items after it stay in it).
export const menus: Record<Role, NavItem[]> = {
  tenant: [
    { href: "/tenant", label: "My home", icon: "key" },
    { href: "/tenant/rent", label: "Rent & receipts", icon: "wallet" },
    { href: "/tenant/requests", label: "Repairs", icon: "wrench" },
    { href: "/tenant/lease", label: "Lease & documents", icon: "file" },
    { href: "/tenant/applications", label: "Applications", icon: "clipboard" },
    { href: "/viewings", label: "Viewings", icon: "viewing" },
    { href: "/tenant/stays", label: "My bookings", icon: "calendar" },
    { href: "/orders", label: "My orders", icon: "bag" },
    { href: "/listings", label: "Find a home", icon: "search", group: "Explore" },
    { href: "/saved", label: "Saved homes & alerts", icon: "heart" },
    { href: "/stays", label: "Short stays", icon: "calendar" },
    { href: "/sale", label: "Land & property for sale", icon: "tag" },
    { href: "/services", label: "Book a service", icon: "sparkles" },
  ],
  landlord: [
    { href: "/landlord", label: "Dashboard", icon: "home" },
    { href: "/landlord/tenants", label: "Tenants & rent", icon: "users", group: "Money" },
    { href: "/landlord/statements", label: "Statements & expenses", icon: "receipt" },
    { href: "/landlord/reports", label: "Financial reports", icon: "chart" },
    { href: "/landlord/payouts", label: "Payouts", icon: "banknote" },
    { href: "/landlord/efris", label: "EFRIS receipts", icon: "receiptText" },
    { href: "/landlord/documents", label: "Receipts & documents", icon: "file" },
    { href: "/landlord/properties", label: "Properties & units", icon: "building", group: "Properties" },
    { href: "/landlord/applications", label: "Applications", icon: "clipboard" },
    { href: "/viewings", label: "Viewings", icon: "viewing" },
    { href: "/landlord/stays", label: "Short stays", icon: "calendar" },
    { href: "/landlord/sale", label: "For sale", icon: "tag" },
    { href: "/landlord/areas", label: "By area", icon: "map" },
    { href: "/landlord/maintenance", label: "Maintenance", icon: "wrench", group: "Day to day" },
    { href: "/landlord/inspections", label: "Inspections", icon: "clipboardCheck" },
    { href: "/landlord/utilities", label: "Utilities & meters", icon: "zap" },
    { href: "/landlord/caretakers", label: "Caretakers", icon: "userCog" },
    { href: "/services", label: "Service providers", icon: "sparkles", group: "Marketplace" },
    { href: "/shop", label: "Shop", icon: "bag" },
  ],
  provider: [
    { href: "/provider", label: "Dashboard", icon: "home" },
    { href: "/provider/jobs", label: "Jobs", icon: "briefcase" },
    { href: "/provider/services", label: "My services", icon: "sparkles" },
    { href: "/provider/products", label: "Items for sale", icon: "package" },
    { href: "/provider/orders", label: "Orders", icon: "bag" },
    { href: "/provider/profile", label: "Business profile", icon: "store" },
  ],
  caretaker: [
    { href: "/caretaker", label: "Today", icon: "home" },
    { href: "/caretaker/rent", label: "Rent & cash", icon: "wallet" },
    { href: "/caretaker/repairs", label: "Repairs", icon: "wrench" },
    { href: "/caretaker/inspections", label: "Inspections", icon: "clipboardCheck" },
    { href: "/caretaker/meters", label: "Meter readings", icon: "zap" },
    { href: "/caretaker/expenses", label: "Expenses", icon: "receipt" },
  ],
  manager: [
    { href: "/manager", label: "Dashboard", icon: "home" },
    { href: "/manager/people", label: "People & approvals", icon: "users", group: "People" },
    { href: "/manager/applications", label: "Applications", icon: "clipboard" },
    { href: "/viewings", label: "Viewings", icon: "viewing" },
    { href: "/manager/tenants", label: "Leases & rent", icon: "file", group: "Money" },
    { href: "/manager/payments", label: "Payments", icon: "wallet" },
    { href: "/manager/statements", label: "Landlord statements", icon: "receipt" },
    { href: "/manager/payouts", label: "Payouts to landlords", icon: "banknote" },
    { href: "/manager/tax", label: "Tax for URA", icon: "landmark" },
    { href: "/manager/efris", label: "EFRIS receipts", icon: "receiptText" },
    { href: "/manager/reports", label: "Financial reports", icon: "chart" },
    { href: "/manager/documents", label: "Receipts & documents", icon: "file" },
    { href: "/manager/properties", label: "Properties", icon: "building", group: "Properties" },
    { href: "/manager/stays", label: "Short stays", icon: "calendar" },
    { href: "/manager/sale", label: "For sale", icon: "tag" },
    { href: "/manager/build", label: "Build & construction", icon: "hardHat" },
    { href: "/manager/areas", label: "By area", icon: "map" },
    { href: "/manager/jobs", label: "Maintenance jobs", icon: "wrench", group: "Day to day" },
    { href: "/manager/inspections", label: "Inspections", icon: "clipboardCheck" },
    { href: "/manager/utilities", label: "Utilities & meters", icon: "zap" },
    { href: "/manager/orders", label: "Shop orders", icon: "bag" },
    { href: "/manager/health", label: "System health", icon: "shield", group: "System" },
  ],
};

/** Splits a menu into its groups: [{ title, items }], the first group having no title. */
export function grouped(items: NavItem[]) {
  const out: { title?: string; items: NavItem[] }[] = [];
  for (const i of items) {
    if (i.group || !out.length) out.push({ title: i.group, items: [] });
    out[out.length - 1].items.push(i);
  }
  return out;
}

/** Bottom tab bar: two tabs, the raised "+" action, two tabs, then Profile. */
export type Tabs = { left: NavItem[]; action: NavItem; right: NavItem[] };

export const tabs: Record<Role | "guest", Tabs> = {
  guest: {
    left: [{ href: "/", label: "Home", icon: "home" }, { href: "/listings", label: "Explore", icon: "search" }],
    action: { href: "/list", label: "List", icon: "plus" },
    right: [{ href: "/services", label: "Services", icon: "sparkles" }, { href: "/login", label: "Sign in", icon: "user" }],
  },
  tenant: {
    // Home is the marketplace; the tenant's own rent, lease and repairs live under "My home".
    left: [{ href: "/", label: "Home", icon: "home" }, { href: "/tenant", label: "My home", icon: "key" }],
    action: { href: "/tenant/requests/new", label: "Report issue", icon: "plus" },
    right: [{ href: "/services", label: "Services", icon: "sparkles" }, { href: "/profile", label: "Profile", icon: "user" }],
  },
  landlord: {
    left: [{ href: "/landlord", label: "Home", icon: "home" }, { href: "/landlord/properties", label: "Properties", icon: "building" }],
    action: { href: "/landlord/properties/new", label: "Add property", icon: "plus" },
    right: [{ href: "/landlord/tenants", label: "Tenants", icon: "users" }, { href: "/profile", label: "Profile", icon: "user" }],
  },
  provider: {
    left: [{ href: "/provider", label: "Home", icon: "home" }, { href: "/provider/jobs", label: "Jobs", icon: "briefcase" }],
    action: { href: "/provider/services#add", label: "Add service", icon: "plus" },
    right: [{ href: "/provider/orders", label: "Orders", icon: "bag" }, { href: "/profile", label: "Profile", icon: "user" }],
  },
  caretaker: {
    left: [{ href: "/caretaker", label: "Today", icon: "home" }, { href: "/caretaker/rent", label: "Rent", icon: "wallet" }],
    action: { href: "/caretaker/repairs#new", label: "Report repair", icon: "plus" },
    right: [{ href: "/caretaker/meters", label: "Meters", icon: "zap" }, { href: "/profile", label: "Profile", icon: "user" }],
  },
  manager: {
    left: [{ href: "/manager", label: "Home", icon: "home" }, { href: "/manager/people", label: "People", icon: "users" }],
    action: { href: "/manager/properties/new", label: "Add property", icon: "plus" },
    right: [{ href: "/manager/jobs", label: "Jobs", icon: "wrench" }, { href: "/profile", label: "Profile", icon: "user" }],
  },
};
