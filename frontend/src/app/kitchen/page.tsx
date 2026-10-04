"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { getKitchenBoard, startPrepUnit, finishPrepUnit, PrepUnitRow } from "@/lib/api";

function todayDateString(): string {
  // Kitchen-local (Asia/Kolkata) calendar date, not browser-local - matches
  // the backend's own "today" definition (see README).
  const now = new Date();
  const istMs = now.getTime() + (5.5 * 60 + now.getTimezoneOffset()) * 60000;
  return new Date(istMs).toISOString().slice(0, 10);
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-neutral-100 text-neutral-600",
  STARTED: "bg-blue-100 text-blue-700",
  DONE: "bg-green-100 text-green-700",
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

  if (loading || !user) return <main className="p-6">Loading...</main>;

  const stations = Array.from(new Set(units.map((u) => u.station))).sort();

  // Group by station for display, preserving whatever order the board returned.
  const byStation = units.reduce<Record<string, PrepUnitRow[]>>((acc, unit) => {
    (acc[unit.station] ??= []).push(unit);
    return acc;
  }, {});

  return (
    <AppShell user={user}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Kitchen board</h1>
        <div className="flex gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded border px-2 py-1 text-sm"
          />
          <select
            value={stationFilter}
            onChange={(e) => setStationFilter(e.target.value)}
            className="rounded border px-2 py-1 text-sm"
          >
            <option value="">All stations</option>
            {stations.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {actionError && <p className="mb-3 text-sm text-red-600">{actionError}</p>}

      {boardLoading ? (
        <p className="text-neutral-500">Loading board...</p>
      ) : units.length === 0 ? (
        <p className="text-neutral-500">No confirmed orders for this date{stationFilter ? " and station" : ""}.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(byStation).map(([station, stationUnits]) => (
            <div key={station} className="rounded-lg border bg-white p-4">
              <h2 className="mb-3 font-medium">{station}</h2>
              <div className="space-y-2">
                {stationUnits.map((unit) => {
                  const isLate = unit.kitchenReadyAt && new Date(unit.kitchenReadyAt).getTime() < now && unit.status !== "DONE";
                  return (
                    <div
                      key={unit.prepUnitId}
                      className={`rounded border p-2 ${isLate ? "border-red-300 bg-red-50" : ""}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{unit.dishName} &times; {unit.quantity}</span>
                        <span className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLES[unit.status]}`}>
                          {unit.status}
                        </span>
                      </div>
                      {unit.chosenOptions.length > 0 && (
                        <p className="text-xs text-neutral-500">{unit.chosenOptions.join(", ")}</p>
                      )}
                      {isLate && <p className="mt-1 text-xs font-medium text-red-600">Running late</p>}
                      <div className="mt-2 flex gap-2">
                        {unit.status === "PENDING" && (
                          <button
                            onClick={() => unit.prepUnitId && handleStart(unit.prepUnitId)}
                            className="rounded border px-2 py-1 text-xs hover:bg-neutral-50"
                          >
                            Start
                          </button>
                        )}
                        {unit.status !== "DONE" && (
                          <button
                            onClick={() => unit.prepUnitId && handleFinish(unit.prepUnitId)}
                            className="rounded bg-black px-2 py-1 text-xs text-white"
                          >
                            Finish
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
    </AppShell>
  );
}
