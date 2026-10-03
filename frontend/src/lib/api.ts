const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export type StaffRole = "ADMIN" | "KITCHEN" | "DISPATCH" | "DRIVER";

export interface Me {
  userId: string;
  email: string;
  role: StaffRole;
  name: string;
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Centralized fetch wrapper: attaches the bearer token, throws a typed
// ApiError on non-2xx so callers can branch on status (e.g. 401 -> redirect
// to login) instead of parsing error shapes ad hoc everywhere.
async function apiFetch<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body.message || message;
    } catch {
      // response wasn't JSON - keep the generic message
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export { ApiError };

// ── Auth ────────────────────────────────────────────────────────────
// No public signup: staff accounts are created by an ADMIN (see backend
// StaffController). This app only ever logs in against existing accounts.

export function login(email: string, password: string) {
  return apiFetch<{ access_token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function getMe(token: string) {
  return apiFetch<Me>("/auth/me", {}, token);
}

// ── Dashboards ──────────────────────────────────────────────────────

export function getAdminDashboard(token: string) {
  return apiFetch<{
    date: string;
    ordersToday: number;
    confirmedToday: number;
    kitchenDoneToday: number;
    deliveredToday: number;
    uninvoicedOrdersCount: number;
    activeCompaniesCount: number;
  }>("/dashboard/admin", {}, token);
}

export function getKitchenDashboard(token: string) {
  return apiFetch<{
    date: string;
    byStation: Record<string, { pending: number; started: number; done: number }>;
    atRiskOrders: number;
  }>("/dashboard/kitchen", {}, token);
}

export function getDispatchDashboard(token: string) {
  return apiFetch<{
    date: string;
    byStatus: Record<string, number>;
    unassignedCount: number;
    totalDeliveriesToday: number;
  }>("/dashboard/dispatch", {}, token);
}

export function getDriverDashboard(token: string) {
  return apiFetch<{ date: string; totalStops: number; delivered: number; remaining: number }>(
    "/dashboard/driver",
    {},
    token,
  );
}

// ── Orders ──────────────────────────────────────────────────────────

export interface OrderListItem {
  id: string;
  deliveryDate: string;
  deliveryTime: string;
  status: string;
  company: { name: string };
  employee: { name: string };
}

export function getOrders(
  token: string,
  filters: { deliveryDateFrom?: string; deliveryDateTo?: string; status?: string; companyId?: string; page?: number },
) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined) params.set(k, String(v));
  });
  return apiFetch<{ items: OrderListItem[]; total: number; page: number; pageSize: number }>(
    `/orders?${params.toString()}`,
    {},
    token,
  );
}

export function getOrder(token: string, id: string) {
  return apiFetch<any>(`/orders/${id}`, {}, token);
}

export function cancelOrder(token: string, id: string) {
  return apiFetch(`/orders/${id}/cancel`, { method: "PATCH" }, token);
}

export function createOrder(
  token: string,
  dto: {
    employeeId: string;
    deliveryDate: string;
    deliveryTime?: string;
    addressId?: string;
    packagingType?: string;
    asDraft?: boolean;
    lines: {
      dishId: string;
      quantity: number;
      combinations: { quantity: number; chosenOptions: { groupId: string; optionId: string }[] }[];
    }[];
  },
) {
  return apiFetch<any>("/orders", { method: "POST", body: JSON.stringify(dto) }, token);
}

// ── Companies / Employees (for order creation + filters) ─────────────

export interface CompanySummary {
  id: string;
  name: string;
  addresses: { id: string; label: string }[];
}

export function getCompanies(token: string) {
  return apiFetch<CompanySummary[]>("/companies", {}, token);
}

export interface EmployeeSummary {
  id: string;
  name: string;
  email: string;
  canChooseAddress: boolean;
  canChangeTime: boolean;
  canChangePackaging: boolean;
}

export function getEmployeesByCompany(token: string, companyId: string) {
  return apiFetch<EmployeeSummary[]>(`/employees?companyId=${companyId}`, {}, token);
}

// ── Menu preview (for order creation) ─────────────────────────────────

export interface MenuOption {
  id: string;
  name: string;
  price: string;
}

export interface MenuOptionGroup {
  id: string;
  name: string;
  required: boolean;
  usesPortions: boolean;
  options: MenuOption[];
}

export interface MenuDish {
  id: string;
  name: string;
  description?: string;
  price: string;
  minOrderQty?: number;
  optionGroups: MenuOptionGroup[];
}

export interface MenuCategory {
  id: string;
  name: string;
  items: MenuDish[];
}

export function getEmployeeMenu(token: string, employeeId: string) {
  return apiFetch<MenuCategory[]>(`/menu/preview/${employeeId}`, {}, token);
}

// ── Kitchen board ───────────────────────────────────────────────────

export interface PrepUnitRow {
  prepUnitId: string;
  combinationId: string;
  orderId: string;
  dishName: string;
  station: string;
  quantity: number;
  chosenOptions: string[];
  status: "PENDING" | "STARTED" | "DONE";
  startedAt?: string;
  doneAt?: string;
  kitchenReadyAt?: string;
  dispatchReadyAt?: string;
}

export function getKitchenBoard(token: string, deliveryDate: string, stationId?: string) {
  const params = new URLSearchParams({ deliveryDate });
  if (stationId) params.set("stationId", stationId);
  return apiFetch<PrepUnitRow[]>(`/kitchen/board?${params.toString()}`, {}, token);
}

export function startPrepUnit(token: string, id: string) {
  return apiFetch(`/kitchen/units/${id}/start`, { method: "POST" }, token);
}

export function finishPrepUnit(token: string, id: string) {
  return apiFetch(`/kitchen/units/${id}/finish`, { method: "POST" }, token);
}

// ── Dispatch board ──────────────────────────────────────────────────

export interface DropRow {
  dropKey: string;
  companyName: string;
  addressLabel: string;
  deliveryTime: string;
  driver: { id: string; name: string } | null;
  status: string;
  orders: { orderId: string; deliveryId?: string; status?: string }[];
}

export function getDispatchBoard(token: string, deliveryDate: string) {
  return apiFetch<DropRow[]>(`/dispatch/board?deliveryDate=${deliveryDate}`, {}, token);
}

export function advanceDelivery(token: string, deliveryId: string, status: string) {
  return apiFetch(`/dispatch/deliveries/${deliveryId}/advance`, {
    method: "POST",
    body: JSON.stringify({ status }),
  }, token);
}

// ── Driver view ─────────────────────────────────────────────────────

export interface DriverDelivery {
  id: string;
  status: string;
  deliveryNote?: string;
  order: {
    id: string;
    deliveryTime: string;
    company: { name: string };
    address: { label: string; line1: string; city: string };
  };
}

export function getMyDeliveries(token: string, date: string) {
  return apiFetch<DriverDelivery[]>(`/dispatch/my-deliveries?date=${date}`, {}, token);
}

export function markDelivered(token: string, deliveryId: string, note?: string) {
  return apiFetch(`/dispatch/deliveries/${deliveryId}/mark-delivered`, {
    method: "POST",
    body: JSON.stringify({ note }),
  }, token);
}