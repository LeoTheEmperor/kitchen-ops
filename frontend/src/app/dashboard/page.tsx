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

  if (loading || !user) return <main className="p-6">Loading...</main>;

  return (
    <AppShell user={user}>
      {dataLoading || !data ? (
        <p className="text-neutral-500">Loading dashboard...</p>
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
    <div>
      <h1 className="mb-1 text-lg font-semibold">Today — {data.date}</h1>
      <p className="mb-4 text-sm text-neutral-500">Operational snapshot and upstream signals</p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Orders today" value={data.ordersToday} />
        <StatCard label="Confirmed" value={data.confirmedToday} />
        <StatCard label="Kitchen done" value={data.kitchenDoneToday} />
        <StatCard label="Delivered" value={data.deliveredToday} />
        <StatCard label="Uninvoiced (all dates)" value={data.uninvoicedOrdersCount} accent={data.uninvoicedOrdersCount > 0 ? "warn" : "default"} />
        <StatCard label="Active companies" value={data.activeCompaniesCount} />
      </div>
    </div>
  );
}

function KitchenDashboard({ data }: { data: any }) {
  const stations = Object.entries(data.byStation) as [string, { pending: number; started: number; done: number }][];
  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold">Kitchen — {data.date}</h1>
      <p className="mb-4 text-sm text-neutral-500">Prep load by station</p>
      {data.atRiskOrders > 0 && (
        <div className="mb-4">
          <StatCard label="Orders at risk (past planned kitchen-ready time)" value={data.atRiskOrders} accent="warn" />
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {stations.map(([station, counts]) => (
          <div key={station} className="rounded-lg border bg-white p-4">
            <div className="mb-2 font-medium">{station}</div>
            <div className="flex gap-3 text-sm">
              <span className="text-neutral-500">Pending: {counts.pending}</span>
              <span className="text-blue-600">Started: {counts.started}</span>
              <span className="text-green-600">Done: {counts.done}</span>
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
    <div>
      <h1 className="mb-1 text-lg font-semibold">Dispatch — {data.date}</h1>
      <p className="mb-4 text-sm text-neutral-500">Today's delivery pipeline</p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statuses.map(([status, count]) => (
          <StatCard key={status} label={status.replace(/_/g, " ")} value={count} />
        ))}
        <StatCard label="Unassigned drops" value={data.unassignedCount} accent={data.unassignedCount > 0 ? "warn" : "default"} />
      </div>
    </div>
  );
}

function DriverDashboard({ data }: { data: any }) {
  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold">Your deliveries — {data.date}</h1>
      <div className="mt-4 grid grid-cols-3 gap-4 max-w-md">
        <StatCard label="Total stops" value={data.totalStops} />
        <StatCard label="Delivered" value={data.delivered} />
        <StatCard label="Remaining" value={data.remaining} accent={data.remaining > 0 ? "warn" : "default"} />
      </div>
    </div>
  );
}