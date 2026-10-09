/** Month grids showing which nights are taken (server-rendered, no JS needed). */
export function StayCalendar({ booked, today, months = 3 }: { booked: Set<string>; today: string; months?: number }) {
  const [y0, m0] = today.split("-").map(Number);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {Array.from({ length: months }, (_, k) => {
        const first = new Date(Date.UTC(y0, m0 - 1 + k, 1));
        const days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
        const lead = (first.getUTCDay() + 6) % 7; // Monday first
        return (
          <div key={k} className="rounded-xl border border-stone-200 bg-white p-2">
            <div className="mb-1 text-center text-xs font-semibold text-brand-900">{first.toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}</div>
            <div className="grid grid-cols-7 gap-0.5 text-center text-[10px]">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <div key={i} className="text-stone-400">{d}</div>)}
              {Array.from({ length: lead }, (_, i) => <div key={`l${i}`} />)}
              {Array.from({ length: days }, (_, i) => {
                const d = `${first.toISOString().slice(0, 8)}${String(i + 1).padStart(2, "0")}`;
                const past = d < today, taken = booked.has(d);
                return <div key={d} title={taken ? "Booked" : undefined} className={`rounded py-1 ${past ? "text-stone-300" : taken ? "bg-maroon-50 text-maroon-400 line-through" : "bg-brand-50 text-brand-800"}`}>{i + 1}</div>;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
