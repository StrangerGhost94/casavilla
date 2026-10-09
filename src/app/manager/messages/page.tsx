import { CheckCircle2, CircleDashed, MessageCircle, Smartphone } from "lucide-react";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { otpMode, smsConfigured, waConfigured } from "@/lib/messaging";
import { Badge, PageHeader, SectionTitle } from "@/components/ui";
import { Submit } from "@/components/client";
import { sendTestMessage } from "../actions";

export const metadata = { title: "WhatsApp & SMS" };

const tone: Record<string, "green" | "gold" | "red" | "gray" | "blue"> = { sent: "green", queued: "blue", test: "gold", failed: "red", expired: "gray" };

export default async function Messages() {
  await requireUser("manager");
  const [rows, counts, verified, users] = await Promise.all([
    db.messageOutbox.findMany({ orderBy: { createdAt: "desc" }, take: 60, include: { user: { select: { name: true } } } }),
    db.messageOutbox.groupBy({ by: ["status"], _count: true, where: { createdAt: { gt: new Date(Date.now() - 30 * 86400000) } } }),
    db.user.count({ where: { phoneVerifiedAt: { not: null } } }),
    db.user.count(),
  ]);
  const wa = waConfigured(), sms = smsConfigured(), mode = otpMode();
  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="WhatsApp & SMS" subtitle="Sign-up codes, password resets, rent reminders and receipts sent to people's phones." />
      <div className="grid gap-3 sm:grid-cols-2">
        <Provider on={wa} icon={<MessageCircle className="h-5 w-5" />} title="WhatsApp (Meta)" hint={wa ? "Connected — tried first for every message" : "Add WHATSAPP_TOKEN and WHATSAPP_PHONE_ID in Railway"} />
        <Provider on={sms} icon={<Smartphone className="h-5 w-5" />} title="SMS (Africa's Talking)" hint={sms ? "Connected — used when WhatsApp can't deliver" : "Add AT_USERNAME and AT_API_KEY in Railway"} />
      </div>
      <div className="card mt-3 text-sm text-stone-700">
        {mode === "live" && <>Phone codes are <b>on</b>: new accounts confirm their number, and “Forgot password” sends a code.</>}
        {mode === "test" && <>Test mode: codes are shown on screen instead of being sent. Nothing reaches anyone&apos;s phone yet.</>}
        {mode === "off" && <>Phone codes are <b>off</b> until WhatsApp or SMS is connected — people sign up without a code, and “Forgot password” points to your WhatsApp.</>}
        <div className="mt-1 text-xs text-stone-500">{verified} of {users} accounts have a confirmed number · last 30 days: {count("sent")} sent, {count("failed")} failed, {count("test")} not sent (no provider)</div>
        {(wa || sms) && <form action={sendTestMessage} className="mt-3"><Submit className="btn-outline btn-sm" doneText="Sent">Send a test to my phone</Submit></form>}
      </div>

      <div className="mt-6"><SectionTitle title="Recent messages" /></div>
      <div className="card divide-y divide-stone-100 p-0">
        {rows.map((m) => (
          <div key={m.id} className="px-4 py-3">
            <div className="flex items-center justify-between gap-2 text-xs text-stone-500">
              <span className="truncate">{m.user?.name ?? m.toPhone} · {m.kind}{m.channel ? ` · ${m.channel === "whatsapp" ? "WhatsApp" : "SMS"}` : ""} · {fmtDateTime(m.createdAt)}</span>
              <Badge color={tone[m.status] ?? "gray"}>{m.status}</Badge>
            </div>
            <div className="mt-1 text-sm text-stone-800">{m.text}</div>
            {m.error && <div className="mt-1 text-[11px] text-maroon-600">{m.error}</div>}
          </div>
        ))}
        {!rows.length && <div className="px-4 py-6 text-center text-sm text-stone-500">Nothing sent yet.</div>}
      </div>
    </div>
  );
}

function Provider({ on, icon, title, hint }: { on: boolean; icon: React.ReactNode; title: string; hint: string }) {
  return (
    <div className={`card flex items-start gap-3 ${on ? "border-brand-100 bg-brand-50/50" : ""}`}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${on ? "bg-[#25D366] text-white" : "bg-stone-100 text-stone-500"}`}>{icon}</span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 font-semibold text-brand-950">{title} {on ? <CheckCircle2 className="h-4 w-4 text-brand-700" /> : <CircleDashed className="h-4 w-4 text-stone-400" />}</div>
        <div className="text-xs text-stone-500">{hint}</div>
      </div>
    </div>
  );
}
