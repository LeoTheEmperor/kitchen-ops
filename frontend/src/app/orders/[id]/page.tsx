"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { getOrder, cancelOrder } from "@/lib/api";

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

  if (loading || !user) return <main className="p-6">Loading...</main>;

  return (
    <AppShell user={user}>
      <button onClick={() => router.push("/orders")} className="mb-4 text-sm text-neutral-500 hover:underline">
        &larr; Back to orders
      </button>

      {orderLoading || !order ? (
        <p className="text-neutral-500">Loading order...</p>
      ) : (
        <div className="max-w-3xl space-y-4">
          <div className="rounded-lg border bg-white p-4">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-lg font-semibold">
                  {order.company.name} — {order.employee.name}
                </h1>
                <p className="text-sm text-neutral-500">
                  Delivery {order.deliveryDate.slice(0, 10)} at {order.deliveryTime} &middot; {order.address.label}
                </p>
              </div>
              <span className="rounded bg-neutral-100 px-3 py-1 text-sm font-medium">{order.status}</span>
            </div>

            {order.packagingType && (
              <p className="mt-2 text-sm text-neutral-500">Packaging: {order.packagingType}</p>
            )}

            {(order.status === "DRAFT" || order.status === "PLACED") && user.role === "ADMIN" && (
              <div className="mt-4">
                <button
                  onClick={handleCancel}
                  className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                >
                  Cancel order
                </button>
                {actionError && <p className="mt-2 text-sm text-red-600">{actionError}</p>}
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-white p-4">
            <h2 className="mb-3 font-medium">Lines</h2>
            <div className="space-y-4">
              {order.lines.map((line: any) => (
                <div key={line.id} className="border-b pb-3 last:border-0 last:pb-0">
                  <div className="flex justify-between text-sm font-medium">
                    <span>{line.dish.name} &times; {line.quantity}</span>
                    <span>₹{Number(line.unitPriceSnapshot).toFixed(2)} each</span>
                  </div>
                  <div className="mt-1 space-y-1">
                    {line.combinations.map((combo: any) => (
                      <div key={combo.id} className="flex justify-between text-sm text-neutral-600">
                        <span>
                          {combo.quantity} &times;{" "}
                          {combo.chosenOptions.length > 0
                            ? combo.chosenOptions.map((o: any) => o.optionNameSnapshot).join(", ")
                            : "no add-ons"}
                        </span>
                        <span>₹{Number(combo.totalPriceSnapshot).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-between border-t pt-3 font-semibold">
              <span>Order total</span>
              <span>
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

          <div className="rounded-lg border bg-white p-4">
            <h2 className="mb-3 font-medium">Timeline</h2>
            <div className="space-y-2">
              {order.statusHistory.map((event: any) => (
                <div key={event.id} className="flex justify-between text-sm">
                  <span className="text-neutral-600">{event.status}</span>
                  <span className="text-neutral-400">{new Date(event.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {order.delivery && (
            <div className="rounded-lg border bg-white p-4">
              <h2 className="mb-3 font-medium">Delivery</h2>
              <p className="text-sm text-neutral-600">Status: {order.delivery.status}</p>
              {order.delivery.driver && (
                <p className="text-sm text-neutral-600">Driver: {order.delivery.driver.name}</p>
              )}
              {order.delivery.deliveredAt && (
                <p className="text-sm text-neutral-600">
                  Delivered: {new Date(order.delivery.deliveredAt).toLocaleString()}{" "}
                  {order.delivery.onTime === true ? "(on time)" : order.delivery.onTime === false ? "(late)" : ""}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
