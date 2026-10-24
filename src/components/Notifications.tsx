import Link from "next/link";
import { Bell, BellOff, CheckCheck } from "lucide-react";
import { db, type User } from "@/db";
import { markAllRead } from "@/app/actions";
import { timeAgo } from "@/lib/format";
import { AutoCloseDetails } from "./client";

/** The bell in the header: unread count, the latest few, mark all read, and a way to see them all. */
export async function NotificationBell({ user, tone }: { user: User; tone: "light" | "dark" }) {
  const [notes, unread] = await Promise.all([
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 6 }),
    db.notification.count({ where: { userId: user.id, read: false } }),
  ]);
  return (
    <AutoCloseDetails className="relative">
      <summary aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        className={`relative flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full ${tone === "light" ? "text-white hover:bg-white/10" : "text-brand-900 hover:bg-stone-100"}`}>
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-maroon-500 px-1 text-[9px] font-bold text-white ring-2 ring-brand-900">{unread > 99 ? "99+" : unread}</span>}
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-stone-200 bg-white text-stone-800 shadow-float">
        <div className="flex items-center gap-2 border-b border-stone-100 px-4 py-3">
          <span className="flex-1 text-sm font-semibold text-brand-950">Notifications{unread > 0 && <span className="ml-1.5 rounded-full bg-maroon-50 px-1.5 py-0.5 text-[11px] text-maroon-600">{unread} new</span>}</span>
          {unread > 0 && (
            <form action={markAllRead}><button className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"><CheckCheck className="h-3.5 w-3.5" /> Mark all read</button></form>
          )}
        </div>
        {notes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-stone-400"><BellOff className="h-5 w-5" /></span>
            <div className="text-sm font-semibold text-stone-700">You&apos;re all caught up</div>
            <div className="text-xs text-stone-500">Payments, repairs and messages will show up here.</div>
          </div>
        ) : (
          <div className="max-h-[60vh] divide-y divide-stone-100 overflow-y-auto">
            {notes.map((n) => <NoteRow key={n.id} n={n} />)}
          </div>
        )}
        <Link href="/notifications" className="block border-t border-stone-100 px-4 py-2.5 text-center text-xs font-semibold text-brand-700 hover:bg-stone-50">See all notifications</Link>
      </div>
    </AutoCloseDetails>
  );
}

/** One notification: unread dot, message and how long ago. Opening it marks it read. */
export function NoteRow({ n, actions }: { n: { id: number; message: string; read: boolean; createdAt: Date }; actions?: React.ReactNode }) {
  return (
    <div className={`flex items-start gap-3 px-4 py-3 ${n.read ? "" : "bg-brand-50/40"}`}>
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-brand-600"}`} aria-hidden />
      {/* A plain link: the route marks it read, so it must not be prefetched. */}
      <a href={`/notifications/${n.id}`} className="min-w-0 flex-1">
        <span className={`block text-sm ${n.read ? "text-stone-600" : "font-medium text-stone-900"}`}>{n.message}</span>
        <span className="mt-0.5 block text-[11px] text-stone-400">{timeAgo(n.createdAt)}{n.read ? "" : " · new"}</span>
      </a>
      {actions}
    </div>
  );
}
