"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { getMyDeliveries, markDelivered, DriverDelivery } from "@/lib/api";

function todayDateString(): string {
  const now = new Date();
  const istMs = now.getTime() + (5.5 * 60 + now.getTimezoneOffset()) * 60000;
  return new Date(istMs).toISOString().slice(0, 10);
}

export default function DriverViewPage() {
  const { user, token, loading } = useAuth();
  const [date] = useState(todayDateString()); // drivers see today only, no date picker needed
  const [deliveries, setDeliveries] = useState<DriverDelivery[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const fetchDeliveries = useCallback(() => {
    if (!token) return;
    setListLoading(true);
    getMyDeliveries(token, date).then(setDeliveries).finally(() => setListLoading(false));
  }, [token, date]);

  useEffect(() => {
    fetchDeliveries();
  }, [fetchDeliveries]);

  async function handleMarkDelivered(deliveryId: string) {
    if (!token) return;
    setActionError(null);
    setSubmittingId(deliveryId);
    try {
      await markDelivered(token, deliveryId, noteDrafts[deliveryId]);
      fetchDeliveries();
    } catch (err: any) {
      setActionError(err.message ?? "Could not mark this delivery");
    } finally {
      setSubmittingId(null);
    }
  }

  if (loading || !user) return <main className="p-6">Loading...</main>;

  const pending = deliveries.filter((d) => d.status !== "DELIVERED");
  const done = deliveries.filter((d) => d.status === "DELIVERED");

  return (
    <AppShell user={user}>
      <h1 className="mb-4 text-lg font-semibold">Today&apos;s deliveries</h1>

      {actionError && <p className="mb-3 text-sm text-red-600">{actionError}</p>}

      {listLoading ? (
        <p className="text-neutral-500">Loading...</p>
      ) : deliveries.length === 0 ? (
        <p className="text-neutral-500">No deliveries assigned to you today.</p>
      ) : (
        <div className="max-w-md space-y-3">
          {pending.map((delivery) => (
            <div key={delivery.id} className="rounded-lg border bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium">{delivery.order.company.name}</div>
                  <div className="text-sm text-neutral-500">
                    {delivery.order.address.line1}, {delivery.order.address.city}
                  </div>
                  <div className="text-sm text-neutral-500">{delivery.order.deliveryTime}</div>
                </div>
                <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs">{delivery.status}</span>
              </div>

              <textarea
                placeholder="Delivery note (optional)"
                value={noteDrafts[delivery.id] ?? ""}
                onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [delivery.id]: e.target.value }))}
                className="mt-3 w-full rounded border px-2 py-1.5 text-sm"
                rows={2}
              />

              <button
                onClick={() => handleMarkDelivered(delivery.id)}
                disabled={submittingId === delivery.id || delivery.status !== "OUT_FOR_DELIVERY"}
                className="mt-2 w-full rounded bg-black py-3 text-sm font-medium text-white disabled:opacity-40"
              >
                {delivery.status !== "OUT_FOR_DELIVERY"
                  ? "Waiting for dispatch"
                  : submittingId === delivery.id
                  ? "Marking..."
                  : "Mark delivered"}
              </button>
            </div>
          ))}

          {done.length > 0 && (
            <div>
              <h2 className="mt-6 mb-2 text-sm font-medium text-neutral-500">Delivered</h2>
              {done.map((delivery) => (
                <div key={delivery.id} className="mb-2 rounded-lg border bg-neutral-50 p-3 text-sm">
                  <div className="font-medium">{delivery.order.company.name}</div>
                  <div className="text-neutral-500">{delivery.order.address.line1}</div>
                  {delivery.deliveryNote && (
                    <div className="mt-1 text-xs text-neutral-500">Note: {delivery.deliveryNote}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
