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
  const [date] = useState(todayDateString());
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

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm font-semibold text-slate-600">Loading driver deliveries...</p>
      </main>
    );
  }

  const pending = deliveries.filter((d) => d.status !== "DELIVERED");
  const done = deliveries.filter((d) => d.status === "DELIVERED");

  return (
    <AppShell user={user}>
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Today&apos;s Deliveries</h1>
          <p className="mt-1 text-sm font-medium text-slate-600">Active stops and delivery confirmations for today</p>
        </div>

        {actionError && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800 shadow-xs">
            ⚠️ {actionError}
          </div>
        )}

        {listLoading ? (
          <div className="flex h-40 items-center justify-center rounded-xl border border-slate-200 bg-white">
            <p className="text-sm font-semibold text-slate-600">Loading your stops...</p>
          </div>
        ) : deliveries.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
            <p className="text-base font-semibold text-slate-800">No deliveries assigned to you today</p>
            <p className="mt-1 text-sm text-slate-600">Assigned drop stops will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pending.map((delivery) => (
              <div key={delivery.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{delivery.order.company.name}</h3>
                    <p className="mt-1 text-sm font-medium text-slate-700">
                      📍 {delivery.order.address.line1}, {delivery.order.address.city}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-600">
                      ⏰ Expected by: <span className="text-slate-900 font-bold">{delivery.order.deliveryTime}</span>
                    </p>
                  </div>
                  <span className="rounded-md border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-xs font-bold text-purple-900">
                    {delivery.status.replace(/_/g, " ")}
                  </span>
                </div>

                <div className="mt-4">
                  <label htmlFor={`note-${delivery.id}`} className="sr-only">Delivery Note</label>
                  <textarea
                    id={`note-${delivery.id}`}
                    placeholder="Delivery note or proof comments (optional)..."
                    value={noteDrafts[delivery.id] ?? ""}
                    onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [delivery.id]: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                    rows={2}
                  />
                </div>

                <button
                  onClick={() => handleMarkDelivered(delivery.id)}
                  disabled={submittingId === delivery.id || delivery.status !== "OUT_FOR_DELIVERY"}
                  className="mt-3 w-full cursor-pointer rounded-lg bg-emerald-600 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                  {delivery.status !== "OUT_FOR_DELIVERY"
                    ? "Waiting for Dispatch Departure"
                    : submittingId === delivery.id
                    ? "Confirming Delivery..."
                    : "Confirm Delivered"}
                </button>
              </div>
            ))}

            {done.length > 0 && (
              <div className="pt-4">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-600">
                  Completed Stops ({done.length})
                </h2>
                <div className="space-y-3">
                  {done.map((delivery) => (
                    <div key={delivery.id} className="rounded-xl border border-slate-200 bg-slate-100/70 p-4 text-sm text-slate-900">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{delivery.order.company.name}</span>
                        <span className="rounded-md border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-900">
                          Delivered
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-600">{delivery.order.address.line1}</div>
                      {delivery.deliveryNote && (
                        <div className="mt-2 rounded bg-white p-2 text-xs font-medium text-slate-700 border border-slate-200">
                          📝 <span className="font-semibold">Note:</span> {delivery.deliveryNote}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
