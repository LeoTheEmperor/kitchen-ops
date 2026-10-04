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

// Each step requires the previous one (4.8) - this is the only legal next
// status from any given current status, used to render a single "advance" button.
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

  if (loading || !user) return <main className="p-6">Loading...</main>;

  return (
    <AppShell user={user}>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Dispatch board</h1>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded border px-2 py-1 text-sm"
        />
      </div>

      {actionError && <p className="mb-3 text-sm text-red-600">{actionError}</p>}

      {boardLoading ? (
        <p className="text-neutral-500">Loading board...</p>
      ) : drops.length === 0 ? (
        <p className="text-neutral-500">No confirmed orders for this date.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="border-b bg-neutral-50 text-left text-neutral-500">
              <tr>
                <th className="px-4 py-2">Company</th>
                <th className="px-4 py-2">Address</th>
                <th className="px-4 py-2">Time</th>
                <th className="px-4 py-2">Orders</th>
                <th className="px-4 py-2">Driver</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {drops.map((drop) => {
                const next = NEXT_STATUS[drop.status];
                // All orders in a drop share one delivery entity per order;
                // advancing requires every order in the drop to have the
                // same current status - use the first order's deliveryId.
                const deliveryId = drop.orders[0]?.deliveryId;
                return (
                  <tr key={drop.dropKey} className="border-b last:border-0">
                    <td className="px-4 py-2 font-medium">{drop.companyName}</td>
                    <td className="px-4 py-2">{drop.addressLabel}</td>
                    <td className="px-4 py-2">{drop.deliveryTime}</td>
                    <td className="px-4 py-2">{drop.orders.length}</td>
                    <td className="px-4 py-2">
                      {drop.driver ? drop.driver.name : (
                        <span className="text-amber-600">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs">
                        {STATUS_LABELS[drop.status] ?? drop.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {next && (
                        <button
                          onClick={() => handleAdvance(deliveryId, next)}
                          disabled={next === "OUT_FOR_DELIVERY" && !drop.driver}
                          title={next === "OUT_FOR_DELIVERY" && !drop.driver ? "Assign a driver first" : undefined}
                          className="rounded border px-3 py-1 text-xs hover:bg-neutral-50 disabled:opacity-40"
                        >
                          Mark {STATUS_LABELS[next]}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
