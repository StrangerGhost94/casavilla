// Demo data so every dashboard has something to show. Run: npm run seed
// Only for an empty database — it stops if the demo accounts already exist.
import bcrypt from "bcryptjs";
import { PrismaClient, type Role, type UserStatus } from "@prisma/client";

const prisma = new PrismaClient();
const PASSWORD = "casavilla123";
const day = (s: string) => new Date(`${s}T00:00:00Z`);

async function main() {
  if (await prisma.user.findUnique({ where: { email: "landlord@demo.casavilla" } })) {
    console.log("Demo data already present.");
    return;
  }
  const hash = await bcrypt.hash(PASSWORD, 10);
  const mk = (v: { name: string; email: string; role: Role; phone?: string; status?: UserStatus; businessName?: string; area?: string; bio?: string }) =>
    prisma.user.create({ data: { phone: "+256772000000", passwordHash: hash, status: "active", ...v } });

  const manager = await mk({ name: "CasaVilla Office", email: "manager@demo.casavilla", role: "manager", phone: "+256776593482" });
  const nakato = await mk({ name: "Grace Nakato", email: "landlord@demo.casavilla", role: "landlord", phone: "+256772410221" });
  const ssemwanga = await mk({ name: "Joseph Ssemwanga", email: "landlord2@demo.casavilla", role: "landlord", phone: "+256701553002", status: "pending" });
  const okello = await mk({ name: "Brian Okello", email: "tenant@demo.casavilla", role: "tenant", phone: "+256778220114" });
  const amina = await mk({ name: "Amina Nansubuga", email: "tenant2@demo.casavilla", role: "tenant", phone: "+256751887340" });
  const david = await mk({ name: "David Mugisha", email: "tenant3@demo.casavilla", role: "tenant", phone: "+256783009512" });
  const fixit = await mk({ name: "Peter Kato", businessName: "Kato FixIt Plumbing & Electrical", email: "provider@demo.casavilla", role: "provider", phone: "+256774556677", area: "Rubaga, Mengo, Ndeeba", bio: "10 years fixing leaks, blocked drains, wiring and water heaters across Kampala. Same-day call-outs." });
  const sparkle = await mk({ name: "Rehema Akello", businessName: "Sparkle Clean UG", email: "provider2@demo.casavilla", role: "provider", phone: "+256705112233", area: "Greater Kampala", bio: "Move-in / move-out deep cleans, office cleaning and fumigation." });
  await mk({ name: "Moses Wasswa", businessName: "Wasswa Carpentry Works", email: "provider3@demo.casavilla", role: "provider", phone: "+256759441100", area: "Nateete", status: "pending" });

  const court = await prisma.property.create({ data: { landlordId: nakato.id, name: "Rubaga Court", type: "Apartments", location: "Rubaga Road, Kampala", description: "Secure gated apartments 5 minutes from Rubaga Cathedral. NWSC water with reserve tank, Yaka power per unit, parking and 24-hour askari." } });
  const rows = await prisma.property.create({ data: { landlordId: nakato.id, name: "Mengo Rentals", type: "Rentals (row houses)", location: "Mengo, Kampala", description: "Self-contained double rooms near Mengo Hospital. Tiled floors, shared compound." } });
  // Locations come from the imported Uganda dataset (run scripts/import-locations.mjs first). Rubaga Court and Mengo Rentals
  // are left with only their old text address, to exercise the "confirm suggested location" flow.
  const place = (name: string, level: string) => prisma.location.findFirst({ where: { name, level }, select: { id: true } });
  const kira = await place("Kira Division", "subcounty");
  await prisma.property.create({ data: { landlordId: ssemwanga.id, name: "Kira Heights", type: "Standalone house", location: "Kira, Wakiso", locationId: kira?.id, description: "3-bedroom standalone with garden." } });
  const kampala = await place("Kampala", "district");
  const rubN = await place("Rubaga Division North", "county"), rubS = await place("Rubaga Division South", "county");
  const areas = [[fixit.id, rubN], [fixit.id, rubS], [sparkle.id, kampala]] as const;
  for (const [providerId, loc] of areas) if (loc) await prisma.providerArea.create({ data: { providerId, locationId: loc.id } });

  const unitData = [
    { propertyId: court.id, label: "Apt A1", bedrooms: 2, rent: 1_200_000, status: "occupied", listed: false },
    { propertyId: court.id, label: "Apt A2", bedrooms: 2, rent: 1_200_000, status: "occupied", listed: false },
    { propertyId: court.id, label: "Apt B1", bedrooms: 3, rent: 1_650_000 },
    { propertyId: court.id, label: "Apt B2", bedrooms: 1, rent: 850_000 },
    { propertyId: rows.id, label: "Room 1", bedrooms: 1, rent: 350_000, status: "occupied", listed: false },
    { propertyId: rows.id, label: "Room 2", bedrooms: 1, rent: 350_000 },
    { propertyId: rows.id, label: "Room 3", bedrooms: 1, rent: 350_000 },
  ];
  const u = [];
  for (const d of unitData) u.push(await prisma.unit.create({ data: d }));

  const now = new Date();
  const ym = (offset: number) => new Date(Date.UTC(now.getFullYear(), now.getMonth() + offset, 1)).toISOString().slice(0, 7);
  const L = [
    await prisma.lease.create({ data: { unitId: u[0].id, tenantId: okello.id, landlordId: nakato.id, startDate: day(`${ym(-3)}-01`), endDate: day(`${ym(9)}-01`), rent: 1_200_000, deposit: 1_200_000, dueDay: 5 } }),
    await prisma.lease.create({ data: { unitId: u[1].id, tenantId: amina.id, landlordId: nakato.id, startDate: day(`${ym(-2)}-01`), endDate: day(`${ym(10)}-01`), rent: 1_200_000, deposit: 0, dueDay: 5 } }),
    await prisma.lease.create({ data: { unitId: u[4].id, tenantId: david.id, landlordId: nakato.id, startDate: day(`${ym(-1)}-01`), endDate: day(`${ym(11)}-01`), rent: 350_000, deposit: 350_000, dueDay: 1 } }),
  ];

  // Charges for each month of each lease up to now.
  for (const l of L) {
    const data: { leaseId: number; period: string; kind?: string; description: string; amount: number; dueDate: Date }[] = [];
    if (l.deposit) data.push({ leaseId: l.id, period: "DEPOSIT", kind: "deposit", description: "Security deposit", amount: l.deposit, dueDate: l.startDate });
    const [y, m] = l.startDate.toISOString().slice(0, 7).split("-").map(Number);
    for (let i = 0; ; i++) {
      const d = new Date(Date.UTC(y, m - 1 + i, 1));
      const p = d.toISOString().slice(0, 7);
      if (p > ym(0)) break;
      const label = d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
      data.push({ leaseId: l.id, period: p, description: `Rent — ${label}`, amount: l.rent, dueDate: day(`${p}-${String(l.dueDay).padStart(2, "0")}`) });
    }
    await prisma.charge.createMany({ data });
  }

  // Payment history: Brian is fully paid, Amina is part-paid last month, David paid only his deposit (in cash).
  const charges = await prisma.charge.findMany({ include: { lease: true }, orderBy: { id: "asc" } });
  let n = 0;
  const pay = async (c: (typeof charges)[number], amount: number, method: string, daysAgo: number) => {
    n++;
    const when = new Date(Date.now() - daysAgo * 86400000);
    const p = await prisma.payment.create({
      data: {
        chargeId: c.id, leaseId: c.leaseId, tenantId: c.lease.tenantId, amount, method, phone: method === "cash" ? null : "+256778220114",
        reference: `SEED${n}`, status: "success", paidAt: when, createdAt: when,
      },
    });
    await prisma.payment.update({ where: { id: p.id }, data: { receiptNo: `CV-${when.getFullYear()}-${String(p.id).padStart(6, "0")}` } });
    await prisma.allocation.create({ data: { paymentId: p.id, chargeId: c.id, amount, source: "payment", createdAt: when } });
    const paid = c.paid + amount;
    await prisma.charge.update({ where: { id: c.id }, data: { paid, status: paid >= c.amount ? "paid" : "partial" } });
  };
  const thisMonth = ym(0);
  for (const c of charges) {
    if (c.lease.tenantId === okello.id) await pay(c, c.amount, "mtn", c.period === thisMonth ? 2 : 35);
    if (c.lease.tenantId === amina.id && c.period !== thisMonth && c.period !== ym(-1)) await pay(c, c.amount, "airtel", 40);
    if (c.lease.tenantId === amina.id && c.period === ym(-1)) await pay(c, 600_000, "airtel", 15);
    if (c.lease.tenantId === david.id && c.period === "DEPOSIT") await pay(c, c.amount, "cash", 30);
  }

  const cleaning = await prisma.service.create({ data: { providerId: sparkle.id, category: "Cleaning", title: "Move-in / move-out deep clean", description: "Whole unit including windows, kitchen degreasing and bathrooms.", priceFrom: 150_000 } });
  await prisma.service.createMany({ data: [
    { providerId: fixit.id, category: "Plumbing", title: "Leak & blocked drain repair", description: "Sinks, toilets, showers, tanks and pipes.", priceFrom: 50_000 },
    { providerId: fixit.id, category: "Electrical", title: "Wiring, sockets & Yaka meter faults", priceFrom: 60_000 },
    { providerId: sparkle.id, category: "Pest control", title: "Fumigation (cockroaches, bedbugs, termites)", priceFrom: 120_000 },
  ] });
  await prisma.product.createMany({ data: [
    { providerId: fixit.id, name: "PPR pipe 20mm (4m)", price: 18_000, stock: 40, description: "Hot & cold water pipe." },
    { providerId: fixit.id, name: "Kitchen sink mixer tap", price: 85_000, stock: 6 },
    { providerId: sparkle.id, name: "Insecticide spray 750ml", price: 22_000, stock: 25 },
  ] });

  const leak = await prisma.job.create({ data: {
    requesterId: okello.id, landlordId: nakato.id, propertyId: court.id, unitId: u[0].id, category: "Plumbing",
    title: "Kitchen sink leaking under cabinet", description: "Water collects under the sink every time we use it. Cabinet base is getting soft.", priority: "urgent",
    providerId: fixit.id, status: "accepted", quote: 80_000,
  } });
  await prisma.jobNote.createMany({ data: [
    { jobId: leak.id, authorId: nakato.id, body: "Assigned to Kato FixIt — please go tomorrow morning." },
    { jobId: leak.id, authorId: fixit.id, body: "Will come at 9am. Likely the trap seal; quote includes parts." },
  ] });
  await prisma.job.create({ data: {
    requesterId: amina.id, landlordId: nakato.id, propertyId: court.id, unitId: u[1].id, category: "Pest control",
    title: "Cockroaches in kitchen", description: "Seeing many at night near the cooker.", status: "open",
  } });
  await prisma.job.create({ data: {
    requesterId: nakato.id, landlordId: nakato.id, propertyId: rows.id, providerId: sparkle.id, serviceId: cleaning.id, category: "Cleaning",
    title: "Clean Room 2 before new tenant", description: "Full deep clean of Room 2 at Mengo Rentals.", status: "done",
  } });
  await prisma.application.create({ data: { unitId: u[2].id, tenantId: david.id, message: "Family of four, I work at Mulago. Would like to move to a bigger unit.", status: "pending" } });
  await prisma.notification.createMany({ data: [
    { userId: nakato.id, message: "David Mugisha applied for Rubaga Court · Apt B1", link: "/landlord/applications" },
    { userId: manager.id, message: "New provider sign-up awaiting approval: Wasswa Carpentry Works", link: "/manager/people" },
  ] });
  console.log(`Seeded. All demo accounts use password: ${PASSWORD}`);
}

main().finally(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
