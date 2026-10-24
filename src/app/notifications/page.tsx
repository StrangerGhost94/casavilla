import Link from "next/link";
import { BellOff, CheckCheck, Trash2, X } from "lucide-react";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { kampalaToday } from "@/lib/format";
import { clearReadNotifications, deleteNotification, markAllRead } from "@/app/actions";
import { PortalShell } from "@/components/PortalShell";
import { PageHeader } from "@/components/ui";
import { ConfirmSubmit } from "@/components/client";
import { NoteRow } from "@/components/Notifications";

export const metadata = { title: "Notifications" };

const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Africa/Kampala" });

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const u = await requireUser();
  const unreadOnly = (await searchParams).show === "unread";
  const [notes, unread, read] = await Promise.all([
    db.notification.findMany({ where: { userId: u.id, ...(unreadOnly ? { read: false } : {}) }, orderBy: { createdAt: "desc" }, take: 200 }),
    db.notification.count({ where: { userId: u.id, read: false } }),
    db.notification.count({ where: { userId: u.id, read: true } }),
  ]);
  // Today / Yesterday / Earlier, in Kampala days.
  const today = kampalaToday();
  const yesterday = new Date(Date.parse(`${today}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const groups = [
    { title: "Today", rows: notes.filter((n) => day(n.createdAt) === today) },
    { title: "Yesterday", rows: notes.filter((n) => day(n.createdAt) === yesterday) },
    { title: "Earlier", rows: notes.filter((n) => day(n.createdAt) < yesterday) },
  ].filter((g) => g.rows.length);

  return (
    <PortalShell user={u}>
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Notifications" subtitle={unread ? `${unread} unread` : "You're all caught up."} actions={
          <>
            {unread > 0 && <form action={markAllRead}><button className="btn-outline btn-sm"><CheckCheck className="h-4 w-4" /> Mark all read</button></form>}
            {read > 0 && <form action={clearReadNotifications}><ConfirmSubmit message={`Delete ${read} read notification${read === 1 ? "" : "s"}? Unread ones stay.`} className="btn-ghost btn-sm"><Trash2 className="h-4 w-4" /> Clear read</ConfirmSubmit></form>}
          </>
        } />

        <nav className="mb-4 flex gap-1 rounded-xl bg-stone-100 p-1 text-sm font-semibold">
          {[["", "All"], ["unread", `Unread${unread ? ` (${unread})` : ""}`]].map(([k, label]) => (
            <Link key={k} href={k ? `/notifications?show=${k}` : "/notifications"}
              className={`flex-1 rounded-lg px-3 py-2 text-center transition ${(k === "unread") === unreadOnly ? "bg-white text-brand-900 shadow-card" : "text-stone-500 hover:text-stone-800"}`}>{label}</Link>
          ))}
        </nav>

        {!groups.length ? (
          <div className="card flex flex-col items-center gap-2 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-400"><BellOff className="h-6 w-6" /></span>
            <div className="font-semibold text-brand-950">{unreadOnly ? "No unread notifications" : "No notifications yet"}</div>
            <div className="text-sm text-stone-500">Payments, repairs, applications and messages will show up here.</div>
          </div>
        ) : groups.map((g) => (
          <section key={g.title} className="mb-5">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">{g.title}</h2>
            <div className="card divide-y divide-stone-100 overflow-hidden p-0">
              {g.rows.map((n) => (
                <NoteRow key={n.id} n={n} actions={
                  <form action={deleteNotification}>
                    <input type="hidden" name="id" value={n.id} />
                    <button aria-label="Delete notification" className="-m-1 rounded-full p-1 text-stone-300 hover:bg-stone-100 hover:text-stone-600"><X className="h-4 w-4" /></button>
                  </form>
                } />
              ))}
            </div>
          </section>
        ))}
        {notes.length === 200 && <p className="text-center text-xs text-stone-400">Showing the latest 200.</p>}
      </div>
    </PortalShell>
  );
}
