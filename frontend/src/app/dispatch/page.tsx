"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { getDispatchBoard, advanceDelivery, DropRow } from "@/lib/api";

function todayDateString(): string {
  const now = new Date();
  const istMs = now.getTime() + (5.5 * 60 + now.getTimezoneOffset()) * 60000;
  return new Date(istMs).toISOString().slice(0, 10);
}

const NEXT_STATUS: Record<string, string | null> = {
  KITCHEN_READY: "DISPATCH_READY",
  DISPATCH_READY: "OUT_FOR_DELIVERY",
  OUT_FOR_DELIVERY: "DELIVERED",
  DELIVERED: null,
};

const STATUS_LABELS: Record<string, string> = {
  KITCHEN_READY: "Kitchen ready",
  DISPATCH_READY: "Dispatch ready",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
};

const STATUS_STYLES: Record<string, string> = {
  KITCHEN_READY: "bg-amber-100 text-amber-900 border-amber-300",
  DISPATCH_READY: "bg-blue-100 text-blue-900 border-blue-300",
  OUT_FOR_DELIVERY: "bg-purple-100 text-purple-900 border-purple-300",
  DELIVERED: "bg-emerald-100 text-emerald-900 border-emerald-300",
};

export default function DispatchBoardPage() {
  const { user, token, loading } = useAuth();
  const [date, setDate] = useState(todayDateString());
  const [drops, setDrops] = useState<DropRow[]>([]);
  const [boardLoading, setBoardLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchBoard = useCallback(() => {
    if (!token) return;
    setBoardLoading(true);
    getDispatchBoard(token, date).then(setDrops).finally(() => setBoardLoading(false));
  }, [token, date]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  async function handleAdvance(deliveryId: string | undefined, nextStatus: string) {
    if (!token || !deliveryId) return;
    setActionError(null);
    try {
      await advanceDelivery(token, deliveryId, nextStatus);
      fetchBoard();
    } catch (err: any) {
      setActionError(err.message ?? "Could not advance this delivery");
    }
  }

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm font-semibold text-slate-600">Loading dispatch board...</p>
      </main>
    );
  }

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dispatch & Delivery Board</h1>
            <p className="mt-1 text-sm font-medium text-slate-600">Coordinate company drops, driver assignments, and delivery statuses</p>
          </div>
          <div>
            <label htmlFor="dispatch-date" className="sr-only">Delivery Date</label>
            <input
              id="dispatch-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-2xs focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
            />
          </div>
        </div>

        {actionError && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800 shadow-xs">
            ⚠️ {actionError}
          </div>
        )}

        {boardLoading ? (
          <div className="flex h-48 items-center justify-center rounded-xl border border-slate-200 bg-white">
            <p className="text-sm font-semibold text-slate-600">Loading dispatch drops...</p>
          </div>
        ) : drops.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
            <p className="text-base font-semibold text-slate-800">No scheduled deliveries for this date</p>
            <p className="mt-1 text-sm text-slate-600">Confirmed orders ready for dispatch will appear here.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-900">
                <thead className="border-b border-slate-200 bg-slate-100/70 text-xs font-bold uppercase tracking-wider text-slate-700">
                  <tr>
                    <th className="px-5 py-3.5">Company</th>
                    <th className="px-5 py-3.5">Address</th>
                    <th className="px-5 py-3.5">Delivery Time</th>
                    <th className="px-5 py-3.5">Orders</th>
                    <th className="px-5 py-3.5">Driver</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {drops.map((drop) => {
                    const next = NEXT_STATUS[drop.status];
                    const deliveryId = drop.orders[0]?.deliveryId;
                    return (
                      <tr key={drop.dropKey} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-4 font-bold text-slate-900">{drop.companyName}</td>
                        <td className="px-5 py-4 text-slate-700">{drop.addressLabel}</td>
                        <td className="px-5 py-4 font-medium text-slate-800">{drop.deliveryTime}</td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-800">
                            {drop.orders.length}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {drop.driver ? (
                            <span className="font-semibold text-slate-900">{drop.driver.name}</span>
                          ) : (
                            <span className="inline-flex items-center rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800">
                              Unassigned
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLES[drop.status] ?? "bg-slate-100 text-slate-800"}`}>
                            {STATUS_LABELS[drop.status] ?? drop.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          {next && (
                            <button
                              onClick={() => handleAdvance(deliveryId, next)}
                              disabled={next === "OUT_FOR_DELIVERY" && !drop.driver}
                              title={next === "OUT_FOR_DELIVERY" && !drop.driver ? "Assign a driver first" : undefined}
                              className="cursor-pointer rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-slate-900"
                            >
                              Advance to {STATUS_LABELS[next]}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
