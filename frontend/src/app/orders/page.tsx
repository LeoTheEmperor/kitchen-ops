"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { getOrders, getCompanies, OrderListItem, CompanySummary } from "@/lib/api";

const STATUS_OPTIONS = ["DRAFT", "PLACED", "CONFIRMED", "DELIVERED", "CANCELLED", "REJECTED"];

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-neutral-100 text-neutral-700",
  PLACED: "bg-blue-100 text-blue-700",
  CONFIRMED: "bg-green-100 text-green-700",
  DELIVERED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
  REJECTED: "bg-red-100 text-red-700",
};

export default function OrdersListPage() {
  const { user, token, loading } = useAuth();
  const [items, setItems] = useState<OrderListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [listLoading, setListLoading] = useState(true);

  // Filters (4.6: searchable, filterable by delivery date range, status, company)
  const [deliveryDateFrom, setDeliveryDateFrom] = useState("");
  const [deliveryDateTo, setDeliveryDateTo] = useState("");
  const [status, setStatus] = useState("");
  const [companyId, setCompanyId] = useState("");

  useEffect(() => {
    if (!token) return;
    getCompanies(token).then(setCompanies);
  }, [token]);

  const fetchOrders = useCallback(() => {
    if (!token) return;
    setListLoading(true);
    getOrders(token, {
      deliveryDateFrom: deliveryDateFrom || undefined,
      deliveryDateTo: deliveryDateTo || undefined,
      status: status || undefined,
      companyId: companyId || undefined,
      page,
    })
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .finally(() => setListLoading(false));
  }, [token, deliveryDateFrom, deliveryDateTo, status, companyId, page]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  if (loading || !user) return <main className="p-6">Loading...</main>;

  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <AppShell user={user}>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Orders</h1>
        {user.role === "ADMIN" && (
          <Link href="/orders/new" className="rounded bg-black px-4 py-2 text-sm text-white">
            New order
          </Link>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-3 rounded-lg border bg-white p-4">
        <div>
          <label className="block text-xs text-neutral-500">From</label>
          <input
            type="date"
            value={deliveryDateFrom}
            onChange={(e) => { setPage(1); setDeliveryDateFrom(e.target.value); }}
            className="rounded border px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">To</label>
          <input
            type="date"
            value={deliveryDateTo}
            onChange={(e) => { setPage(1); setDeliveryDateTo(e.target.value); }}
            className="rounded border px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Status</label>
          <select
            value={status}
            onChange={(e) => { setPage(1); setStatus(e.target.value); }}
            className="rounded border px-2 py-1 text-sm"
          >
            <option value="">All</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Company</label>
          <select
            value={companyId}
            onChange={(e) => { setPage(1); setCompanyId(e.target.value); }}
            className="rounded border px-2 py-1 text-sm"
          >
            <option value="">All</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-neutral-50 text-left text-neutral-500">
            <tr>
              <th className="px-4 py-2">Delivery date</th>
              <th className="px-4 py-2">Time</th>
              <th className="px-4 py-2">Company</th>
              <th className="px-4 py-2">Employee</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {listLoading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-neutral-400">Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-neutral-400">No orders match these filters</td></tr>
            ) : (
              items.map((order) => (
                <tr key={order.id} className="border-b last:border-0 hover:bg-neutral-50">
                  <td className="px-4 py-2">
                    <Link href={`/orders/${order.id}`} className="text-blue-600 hover:underline">
                      {order.deliveryDate.slice(0, 10)}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{order.deliveryTime}</td>
                  <td className="px-4 py-2">{order.company.name}</td>
                  <td className="px-4 py-2">{order.employee.name}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs ${STATUS_COLORS[order.status] ?? "bg-neutral-100"}`}>
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm text-neutral-500">
        <span>{total} order{total === 1 ? "" : "s"} total</span>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded border px-3 py-1 disabled:opacity-40"
          >
            Previous
          </button>
          <span>Page {page} of {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border px-3 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </AppShell>
  );
}