"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import {
  getAdminDashboard,
  getKitchenDashboard,
  getDispatchDashboard,
  getDriverDashboard,
} from "@/lib/api";

export default function DashboardPage() {
  const { user, token, loading } = useAuth();
  const [data, setData] = useState<any>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!user || !token) return;
    const fetcher =
      user.role === "ADMIN" ? getAdminDashboard :
      user.role === "KITCHEN" ? getKitchenDashboard :
      user.role === "DISPATCH" ? getDispatchDashboard :
      getDriverDashboard;
    fetcher(token).then(setData).finally(() => setDataLoading(false));
  }, [user, token]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm font-semibold text-slate-600">Loading your workspace...</p>
      </main>
    );
  }

  return (
    <AppShell user={user}>
      {dataLoading || !data ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-slate-200 bg-white">
          <p className="text-sm font-medium text-slate-600">Loading dashboard metrics...</p>
        </div>
      ) : user.role === "ADMIN" ? (
        <AdminDashboard data={data} />
      ) : user.role === "KITCHEN" ? (
        <KitchenDashboard data={data} />
      ) : user.role === "DISPATCH" ? (
        <DispatchDashboard data={data} />
      ) : (
        <DriverDashboard data={data} />
      )}
    </AppShell>
  );
}

function AdminDashboard({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Today &mdash; {data.date}</h1>
        <p className="mt-1 text-sm font-medium text-slate-600">Operational snapshot and upstream signals</p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Orders Today" value={data.ordersToday} />
        <StatCard label="Confirmed" value={data.confirmedToday} />
        <StatCard label="Kitchen Done" value={data.kitchenDoneToday} />
        <StatCard label="Delivered" value={data.deliveredToday} />
        <StatCard label="Uninvoiced" value={data.uninvoicedOrdersCount} accent={data.uninvoicedOrdersCount > 0 ? "warn" : "default"} />
        <StatCard label="Active Companies" value={data.activeCompaniesCount} />
      </div>
    </div>
  );
}

function KitchenDashboard({ data }: { data: any }) {
  const stations = Object.entries(data.byStation) as [string, { pending: number; started: number; done: number }][];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Kitchen &mdash; {data.date}</h1>
        <p className="mt-1 text-sm font-medium text-slate-600">Prep load by kitchen station</p>
      </div>
      {data.atRiskOrders > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-800">Orders at risk</div>
          <div className="mt-1 text-2xl font-bold text-amber-950">{data.atRiskOrders}</div>
          <p className="mt-1 text-xs text-amber-800">Past planned kitchen-ready time</p>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stations.map(([station, counts]) => (
          <div key={station} className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="mb-3 text-base font-bold text-slate-900">{station}</div>
            <div className="flex flex-col gap-2 text-sm font-medium">
              <div className="flex items-center justify-between rounded-md bg-slate-100 px-2.5 py-1 text-slate-800">
                <span>Pending</span>
                <span className="font-bold">{counts.pending}</span>
              </div>
              <div className="flex items-center justify-between rounded-md bg-blue-100 px-2.5 py-1 text-blue-900">
                <span>Started</span>
                <span className="font-bold">{counts.started}</span>
              </div>
              <div className="flex items-center justify-between rounded-md bg-emerald-100 px-2.5 py-1 text-emerald-900">
                <span>Done</span>
                <span className="font-bold">{counts.done}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DispatchDashboard({ data }: { data: any }) {
  const statuses = Object.entries(data.byStatus) as [string, number][];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dispatch &mdash; {data.date}</h1>
        <p className="mt-1 text-sm font-medium text-slate-600">Today&apos;s delivery pipeline</p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statuses.map(([status, count]) => (
          <StatCard key={status} label={status.replace(/_/g, " ")} value={count} />
        ))}
        <StatCard label="Unassigned Drops" value={data.unassignedCount} accent={data.unassignedCount > 0 ? "warn" : "default"} />
      </div>
    </div>
  );
}

function DriverDashboard({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Your Deliveries &mdash; {data.date}</h1>
        <p className="mt-1 text-sm font-medium text-slate-600">Today&apos;s scheduled stops</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 max-w-xl">
        <StatCard label="Total Stops" value={data.totalStops} />
        <StatCard label="Delivered" value={data.delivered} />
        <StatCard label="Remaining" value={data.remaining} accent={data.remaining > 0 ? "warn" : "default"} />
      </div>
    </div>
  );
}
