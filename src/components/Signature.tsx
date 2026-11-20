import { PenLine } from "lucide-react";

/** Reason + password, for actions the audit trail records as signed. Pair with requireSignature() in the action. */
export function Signature({ reasonHint = "Reason", className = "" }: { reasonHint?: string; className?: string }) {
  return (
    <div className={`flex w-full flex-wrap items-center gap-1.5 ${className}`}>
      <span className="flex items-center gap-1 text-[11px] font-semibold text-stone-500"><PenLine className="h-3.5 w-3.5" /> Sign:</span>
      <input name="signReason" required minLength={4} maxLength={300} placeholder={reasonHint} aria-label="Reason" className="input min-w-0 flex-1 py-1.5 text-sm" autoComplete="off" />
      <input name="signPassword" type="password" required placeholder="Your password" aria-label="Your password, as your signature" className="input w-36 py-1.5 text-sm" autoComplete="current-password" />
    </div>
  );
}
