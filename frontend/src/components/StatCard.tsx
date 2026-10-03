export function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: "warn" | "default" }) {
    return (
      <div className={`rounded-lg border bg-white p-4 ${accent === "warn" ? "border-amber-300 bg-amber-50" : ""}`}>
        <div className="text-sm text-neutral-500">{label}</div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
      </div>
    );
  }