"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { getOrders, getCompanies, OrderListItem, CompanySummary } from "@/lib/api";

const STATUS_OPTIONS = ["DRAFT", "PLACED", "CONFIRMED", "DELIVERED", "CANCELLED", "REJECTED"];

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-800 border-slate-300",
  PLACED: "bg-blue-100 text-blue-900 border-blue-300",
  CONFIRMED: "bg-emerald-100 text-emerald-900 border-emerald-300",
  DELIVERED: "bg-teal-100 text-teal-900 border-teal-300",
  CANCELLED: "bg-rose-100 text-rose-900 border-rose-300",
  REJECTED: "bg-rose-100 text-rose-900 border-rose-300",
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

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm font-semibold text-slate-600">Loading orders...</p>
      </main>
    );
  }

  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Orders Directory</h1>
            <p className="mt-1 text-sm font-medium text-slate-600">Search and filter active and historical customer orders</p>
          </div>
          {user.role === "ADMIN" && (
            <Link
              href="/orders/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              <span>+</span> New Order
            </Link>
          )}
        </div>

        {/* Filter Toolbar */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="from-date" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                From Date
              </label>
              <input
                id="from-date"
                type="date"
                value={deliveryDateFrom}
                onChange={(e) => { setPage(1); setDeliveryDateFrom(e.target.value); }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-2xs focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>
            <div>
              <label htmlFor="to-date" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                To Date
              </label>
              <input
                id="to-date"
                type="date"
                value={deliveryDateTo}
                onChange={(e) => { setPage(1); setDeliveryDateTo(e.target.value); }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-2xs focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>
            <div>
              <label htmlFor="status-filter" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Order Status
              </label>
              <select
                id="status-filter"
                value={status}
                onChange={(e) => { setPage(1); setStatus(e.target.value); }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-2xs focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
              >
                <option value="">All Statuses</option>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="company-filter" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Company
              </label>
              <select
                id="company-filter"
                value={companyId}
                onChange={(e) => { setPage(1); setCompanyId(e.target.value); }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-2xs focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
              >
                <option value="">All Companies</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-900">
              <thead className="border-b border-slate-200 bg-slate-100/70 text-xs font-bold uppercase tracking-wider text-slate-700">
                <tr>
                  <th className="px-5 py-3.5">Delivery Date</th>
                  <th className="px-5 py-3.5">Time</th>
                  <th className="px-5 py-3.5">Company</th>
                  <th className="px-5 py-3.5">Employee</th>
                  <th className="px-5 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {listLoading ? (
                  <tr><td colSpan={5} className="px-5 py-8 text-center font-semibold text-slate-500">Loading orders...</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-8 text-center font-medium text-slate-500">No orders match these filters.</td></tr>
                ) : (
                  items.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-4 font-bold">
                        <Link href={`/orders/${order.id}`} className="text-emerald-700 hover:text-emerald-800 hover:underline">
                          {order.deliveryDate.slice(0, 10)}
                        </Link>
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-700">{order.deliveryTime}</td>
                      <td className="px-5 py-4 font-bold text-slate-900">{order.company.name}</td>
                      <td className="px-5 py-4 text-slate-700">{order.employee.name}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-bold ${STATUS_COLORS[order.status] ?? "bg-slate-100 text-slate-800"}`}>
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm font-medium text-slate-700">
          <span>Showing <strong className="text-slate-900">{total}</strong> total order{total === 1 ? "" : "s"}</span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-2xs hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-slate-900"
            >
              Previous
            </button>
            <span className="text-xs font-semibold text-slate-700">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-2xs hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-slate-900"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}