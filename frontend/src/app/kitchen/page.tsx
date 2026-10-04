"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { getKitchenBoard, startPrepUnit, finishPrepUnit, PrepUnitRow } from "@/lib/api";

function todayDateString(): string {
  const now = new Date();
  const istMs = now.getTime() + (5.5 * 60 + now.getTimezoneOffset()) * 60000;
  return new Date(istMs).toISOString().slice(0, 10);
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-900 border-amber-300",
  STARTED: "bg-blue-100 text-blue-900 border-blue-300",
  DONE: "bg-emerald-100 text-emerald-900 border-emerald-300",
};

export default function KitchenBoardPage() {
  const { user, token, loading } = useAuth();
  const [date, setDate] = useState(todayDateString());
  const [units, setUnits] = useState<PrepUnitRow[]>([]);
  const [boardLoading, setBoardLoading] = useState(true);
  const [stationFilter, setStationFilter] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const fetchBoard = useCallback(() => {
    if (!token) return;
    setBoardLoading(true);
    getKitchenBoard(token, date, stationFilter || undefined)
      .then(setUnits)
      .finally(() => setBoardLoading(false));
  }, [token, date, stationFilter]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  async function handleStart(id: string) {
    if (!token) return;
    setActionError(null);
    try {
      await startPrepUnit(token, id);
      fetchBoard();
    } catch (err: any) {
      setActionError(err.message ?? "Could not start this unit");
    }
  }

  async function handleFinish(id: string) {
    if (!token) return;
    setActionError(null);
    try {
      await finishPrepUnit(token, id);
      fetchBoard();
    } catch (err: any) {
      setActionError(err.message ?? "Could not finish this unit");
    }
  }

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm font-semibold text-slate-600">Loading kitchen board...</p>
      </main>
    );
  }

  const stations = Array.from(new Set(units.map((u) => u.station))).sort();

  const byStation = units.reduce<Record<string, PrepUnitRow[]>>((acc, unit) => {
    (acc[unit.station] ??= []).push(unit);
    return acc;
  }, {});

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Kitchen Prep Board</h1>
            <p className="mt-1 text-sm font-medium text-slate-600">Live station batches and dish prep progress</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label htmlFor="date-input" className="sr-only">Select Date</label>
              <input
                id="date-input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-2xs focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>
            <div>
              <label htmlFor="station-select" className="sr-only">Filter by Station</label>
              <select
                id="station-select"
                value={stationFilter}
                onChange={(e) => setStationFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-2xs focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
              >
                <option value="">All Stations</option>
                {stations.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {actionError && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800 shadow-xs">
            ⚠️ {actionError}
          </div>
        )}

        {boardLoading ? (
          <div className="flex h-48 items-center justify-center rounded-xl border border-slate-200 bg-white">
            <p className="text-sm font-semibold text-slate-600">Loading prep units...</p>
          </div>
        ) : units.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
            <p className="text-base font-semibold text-slate-800">No confirmed prep units for this date</p>
            <p className="mt-1 text-sm text-slate-600">
              {stationFilter ? `No items found under "${stationFilter}".` : "Orders will appear here once placed and confirmed."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {Object.entries(byStation).map(([station, stationUnits]) => (
              <div key={station} className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                  <h2 className="text-base font-bold text-slate-900">{station}</h2>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                    {stationUnits.length} item{stationUnits.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="space-y-3">
                  {stationUnits.map((unit) => {
                    const isLate = unit.kitchenReadyAt && new Date(unit.kitchenReadyAt).getTime() < now && unit.status !== "DONE";
                    return (
                      <div
                        key={unit.prepUnitId}
                        className={`rounded-lg border p-3.5 transition-all ${
                          isLate
                            ? "border-rose-300 bg-rose-50/70 text-rose-950"
                            : "border-slate-200 bg-slate-50/50 hover:border-slate-300 text-slate-900"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            {unit.dishName} <span className="text-emerald-700 font-extrabold">&times; {unit.quantity}</span>
                          </span>
                          <span className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-bold ${STATUS_STYLES[unit.status]}`}>
                            {unit.status}
                          </span>
                        </div>
                        {unit.chosenOptions.length > 0 && (
                          <p className="mt-1.5 text-xs font-medium text-slate-600">
                            <span className="font-semibold text-slate-700">Options:</span> {unit.chosenOptions.join(", ")}
                          </p>
                        )}
                        {isLate && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-rose-700">
                            <span>⏱️ Running late</span>
                          </div>
                        )}
                        <div className="mt-3 flex items-center gap-2">
                          {unit.status === "PENDING" && (
                            <button
                              onClick={() => unit.prepUnitId && handleStart(unit.prepUnitId)}
                              className="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-2xs hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-900"
                            >
                              Start Prep
                            </button>
                          )}
                          {unit.status !== "DONE" && (
                            <button
                              onClick={() => unit.prepUnitId && handleFinish(unit.prepUnitId)}
                              className="cursor-pointer rounded-md bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs transition-colors hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-600"
                            >
                              Mark Finished
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
