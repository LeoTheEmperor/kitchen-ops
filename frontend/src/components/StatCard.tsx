export function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: "warn" | "default";
}) {
  const isWarn = accent === "warn";
  return (
    <div
      className={`rounded-xl border p-4 shadow-xs transition-all ${
        isWarn
          ? "border-amber-300 bg-amber-50/80 text-amber-950"
          : "border-slate-200 bg-white text-slate-900 hover:border-slate-300"
      }`}
    >
      <div className={`text-xs font-semibold uppercase tracking-wider ${isWarn ? "text-amber-800" : "text-slate-600"}`}>
        {label}
      </div>
      <div className={`mt-1.5 text-2xl font-bold tracking-tight ${isWarn ? "text-amber-950" : "text-slate-900"}`}>
        {value}
      </div>
    </div>
  );
}