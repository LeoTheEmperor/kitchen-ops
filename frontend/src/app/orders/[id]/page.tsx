"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { getOrder, cancelOrder } from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-800 border-slate-300",
  PLACED: "bg-blue-100 text-blue-900 border-blue-300",
  CONFIRMED: "bg-emerald-100 text-emerald-900 border-emerald-300",
  DELIVERED: "bg-teal-100 text-teal-900 border-teal-300",
  CANCELLED: "bg-rose-100 text-rose-900 border-rose-300",
  REJECTED: "bg-rose-100 text-rose-900 border-rose-300",
};

export default function OrderDetailPage() {
  const { user, token, loading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<any>(null);
  const [orderLoading, setOrderLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  function refetch() {
    if (!token) return;
    setOrderLoading(true);
    getOrder(token, orderId).then(setOrder).finally(() => setOrderLoading(false));
  }

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, orderId]);

  async function handleCancel() {
    if (!token) return;
    setActionError(null);
    try {
      await cancelOrder(token, orderId);
      refetch();
    } catch (err: any) {
      setActionError(err.message ?? "Could not cancel this order");
    }
  }

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm font-semibold text-slate-600">Loading order details...</p>
      </main>
    );
  }

  return (
    <AppShell user={user}>
      <div className="max-w-4xl space-y-6">
        <button
          onClick={() => router.push("/orders")}
          className="cursor-pointer inline-flex items-center gap-1.5 text-sm font-bold text-slate-700 hover:text-slate-900"
        >
          &larr; Back to Orders
        </button>

        {orderLoading || !order ? (
          <div className="flex h-48 items-center justify-center rounded-xl border border-slate-200 bg-white">
            <p className="text-sm font-semibold text-slate-600">Loading order summary...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    {order.company.name} &mdash; <span className="text-slate-700">{order.employee.name}</span>
                  </h1>
                  <p className="mt-1 text-sm font-medium text-slate-600">
                    📅 Delivery on <strong className="text-slate-900">{order.deliveryDate.slice(0, 10)}</strong> at <strong className="text-slate-900">{order.deliveryTime}</strong> &bull; 📍 {order.address.label}
                  </p>
                </div>
                <span className={`inline-flex items-center rounded-md border px-3 py-1 text-xs font-bold ${STATUS_COLORS[order.status] ?? "bg-slate-100 text-slate-900"}`}>
                  {order.status}
                </span>
              </div>

              {order.packagingType && (
                <div className="mt-3 text-xs font-semibold text-slate-600">
                  📦 Packaging: <span className="font-bold text-slate-800">{order.packagingType}</span>
                </div>
              )}

              {(order.status === "DRAFT" || order.status === "PLACED") && user.role === "ADMIN" && (
                <div className="mt-5 border-t border-slate-200 pt-4">
                  <button
                    onClick={handleCancel}
                    className="cursor-pointer rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 focus-visible:ring-2 focus-visible:ring-rose-600"
                  >
                    Cancel Order
                  </button>
                  {actionError && <p className="mt-2 text-xs font-bold text-rose-700">{actionError}</p>}
                </div>
              )}
            </div>

            {/* Line Items */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
              <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">Line Items</h2>
              <div className="mt-4 space-y-4">
                {order.lines.map((line: any) => (
                  <div key={line.id} className="rounded-lg border border-slate-100 bg-slate-50/60 p-4">
                    <div className="flex items-center justify-between text-sm font-bold text-slate-900">
                      <span>{line.dish.name} <span className="text-emerald-700 font-extrabold">&times; {line.quantity}</span></span>
                      <span>₹{Number(line.unitPriceSnapshot).toFixed(2)} each</span>
                    </div>
                    <div className="mt-2.5 space-y-1.5 border-t border-slate-200/60 pt-2">
                      {line.combinations.map((combo: any) => (
                        <div key={combo.id} className="flex items-center justify-between text-xs font-medium text-slate-700">
                          <span>
                            &bull; {combo.quantity} &times;{" "}
                            {combo.chosenOptions.length > 0
                              ? combo.chosenOptions.map((o: any) => o.optionNameSnapshot).join(", ")
                              : "No add-on options"}
                          </span>
                          <span className="font-bold text-slate-900">₹{Number(combo.totalPriceSnapshot).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4 text-base font-bold text-slate-900">
                <span>Total Order Amount</span>
                <span className="text-xl text-emerald-700">
                  ₹{order.lines
                    .reduce(
                      (sum: number, line: any) =>
                        sum + line.combinations.reduce((s: number, c: any) => s + Number(c.totalPriceSnapshot), 0),
                      0,
                    )
                    .toFixed(2)}
                </span>
              </div>
            </div>

            {/* Timeline */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
              <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">Status Timeline</h2>
              <div className="mt-4 space-y-3">
                {order.statusHistory.map((event: any) => (
                  <div key={event.id} className="flex items-center justify-between text-sm">
                    <span className="font-bold text-slate-800">{event.status}</span>
                    <span className="text-xs font-medium text-slate-600">{new Date(event.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Delivery Info */}
            {order.delivery && (
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
                <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">Delivery Information</h2>
                <div className="mt-4 space-y-2 text-sm text-slate-800 font-medium">
                  <p>Status: <strong className="text-slate-900">{order.delivery.status.replace(/_/g, " ")}</strong></p>
                  {order.delivery.driver && (
                    <p>Assigned Driver: <strong className="text-slate-900">{order.delivery.driver.name}</strong></p>
                  )}
                  {order.delivery.deliveredAt && (
                    <p>
                      Delivered At: <strong className="text-slate-900">{new Date(order.delivery.deliveredAt).toLocaleString()}</strong>{" "}
                      {order.delivery.onTime === true ? (
                        <span className="ml-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">On Time</span>
                      ) : order.delivery.onTime === false ? (
                        <span className="ml-1 text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">Late</span>
                      ) : null}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
