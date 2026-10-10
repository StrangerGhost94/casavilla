// Navigation for each kind of account. Icons are lucide names, resolved in NavIcons.tsx.
export type Role = "tenant" | "landlord" | "provider" | "manager" | "caretaker";
export type NavItem = { href: string; label: string; icon: string };

export const roleName: Record<Role, string> = {
  tenant: "Tenant", landlord: "Landlord", provider: "Service provider", manager: "Property manager", caretaker: "Caretaker",
};

export const menus: Record<Role, NavItem[]> = {
  tenant: [
    { href: "/tenant", label: "Home", icon: "home" },
    { href: "/tenant/rent", label: "Rent & receipts", icon: "wallet" },
    { href: "/tenant/requests", label: "Maintenance", icon: "wrench" },
    { href: "/tenant/lease", label: "Lease & documents", icon: "file" },
    { href: "/tenant/applications", label: "Applications", icon: "clipboard" },
    { href: "/listings", label: "Find a home", icon: "search" },
    { href: "/stays", label: "Short stays", icon: "calendar" },
    { href: "/sale", label: "Land & property for sale", icon: "tag" },
    { href: "/tenant/stays", label: "My bookings", icon: "calendar" },
    { href: "/services", label: "Book a service", icon: "sparkles" },
    { href: "/orders", label: "My orders", icon: "bag" },
  ],
  landlord: [
    { href: "/landlord", label: "Dashboard", icon: "home" },
    { href: "/landlord/properties", label: "Properties & units", icon: "building" },
    { href: "/landlord/applications", label: "Applications", icon: "clipboard" },
    { href: "/landlord/tenants", label: "Tenants & rent", icon: "users" },
    { href: "/landlord/statements", label: "Statements & expenses", icon: "chart" },
    { href: "/landlord/maintenance", label: "Maintenance", icon: "wrench" },
    { href: "/landlord/inspections", label: "Inspections", icon: "clipboardCheck" },
    { href: "/landlord/utilities", label: "Utilities & meters", icon: "zap" },
    { href: "/landlord/caretakers", label: "Caretakers", icon: "userCog" },
    { href: "/landlord/areas", label: "By area", icon: "map" },
    { href: "/landlord/stays", label: "Short stays", icon: "calendar" },
    { href: "/landlord/sale", label: "For sale", icon: "tag" },
    { href: "/landlord/documents", label: "Receipts & documents", icon: "file" },
    { href: "/services", label: "Service providers", icon: "sparkles" },
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
    { href: "/manager/people", label: "People & approvals", icon: "users" },
    { href: "/manager/properties", label: "Properties", icon: "building" },
    { href: "/manager/applications", label: "Applications", icon: "clipboard" },
    { href: "/manager/tenants", label: "Leases & rent", icon: "file" },
    { href: "/manager/payments", label: "Payments", icon: "wallet" },
    { href: "/manager/statements", label: "Statements & expenses", icon: "chart" },
    { href: "/manager/inspections", label: "Inspections", icon: "clipboardCheck" },
    { href: "/manager/utilities", label: "Utilities & meters", icon: "zap" },
    { href: "/manager/jobs", label: "Maintenance jobs", icon: "wrench" },
    { href: "/manager/areas", label: "By area", icon: "map" },
    { href: "/manager/orders", label: "Shop orders", icon: "bag" },
    { href: "/manager/stays", label: "Short stays", icon: "calendar" },
    { href: "/manager/sale", label: "For sale", icon: "tag" },
    { href: "/manager/documents", label: "Receipts & documents", icon: "file" },
    { href: "/manager/health", label: "System health", icon: "shield" },
  ],
};

/** Bottom tab bar: two tabs, the raised "+" action, two tabs, then Profile. */
export type Tabs = { left: NavItem[]; action: NavItem; right: NavItem[] };

export const tabs: Record<Role | "guest", Tabs> = {
  guest: {
    left: [{ href: "/", label: "Home", icon: "home" }, { href: "/listings", label: "Discover", icon: "search" }],
    action: { href: "/register", label: "Join", icon: "plus" },
    right: [{ href: "/services", label: "Services", icon: "sparkles" }, { href: "/login", label: "Sign in", icon: "user" }],
  },
  tenant: {
    left: [{ href: "/tenant", label: "Home", icon: "home" }, { href: "/listings", label: "Discover", icon: "search" }],
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
