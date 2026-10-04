"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import {
  getCompanies, getEmployeesByCompany, getEmployeeMenu, createOrder,
  CompanySummary, EmployeeSummary, MenuCategory, MenuDish,
} from "@/lib/api";

interface CartLine {
  key: string;
  dish: MenuDish;
  quantity: number;
  combinations: { quantity: number; chosenOptions: Record<string, string> }[];
}

export default function NewOrderPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();

  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [employee, setEmployee] = useState<EmployeeSummary | null>(null);

  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [addressId, setAddressId] = useState("");
  const [packagingType, setPackagingType] = useState("");

  const [menu, setMenu] = useState<MenuCategory[] | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    getCompanies(token).then(setCompanies);
  }, [token]);

  useEffect(() => {
    if (!token || !companyId) { setEmployees([]); return; }
    getEmployeesByCompany(token, companyId).then(setEmployees);
    setEmployeeId("");
    setEmployee(null);
    setMenu(null);
    setCart([]);
  }, [token, companyId]);

  useEffect(() => {
    const emp = employees.find((e) => e.id === employeeId) ?? null;
    setEmployee(emp);
  }, [employeeId, employees]);

  useEffect(() => {
    if (!token || !employeeId) { setMenu(null); return; }
    getEmployeeMenu(token, employeeId).then(setMenu);
    setCart([]);
  }, [token, employeeId]);

  const selectedCompany = companies.find((c) => c.id === companyId);

  function addDishToCart(dish: MenuDish) {
    setCart((prev) => [
      ...prev,
      {
        key: `${dish.id}-${Date.now()}`,
        dish,
        quantity: 1,
        combinations: [{ quantity: 1, chosenOptions: {} }],
      },
    ]);
  }

  function updateLineQuantity(key: string, quantity: number) {
    setCart((prev) => prev.map((line) => (line.key === key ? { ...line, quantity } : line)));
  }

  function removeLine(key: string) {
    setCart((prev) => prev.filter((line) => line.key !== key));
  }

  function addCombination(key: string) {
    setCart((prev) =>
      prev.map((line) =>
        line.key === key
          ? { ...line, combinations: [...line.combinations, { quantity: 1, chosenOptions: {} }] }
          : line,
      ),
    );
  }

  function updateCombination(key: string, comboIndex: number, patch: Partial<{ quantity: number; chosenOptions: Record<string, string> }>) {
    setCart((prev) =>
      prev.map((line) => {
        if (line.key !== key) return line;
        const nextCombos = line.combinations.map((c, i) => (i === comboIndex ? { ...c, ...patch } : c));
        return { ...line, combinations: nextCombos };
      }),
    );
  }

  function removeCombination(key: string, comboIndex: number) {
    setCart((prev) =>
      prev.map((line) => {
        if (line.key !== key) return line;
        return { ...line, combinations: line.combinations.filter((_, i) => i !== comboIndex) };
      }),
    );
  }

  function comboPrice(dish: MenuDish, chosenOptions: Record<string, string>): number {
    let sum = Number(dish.price);
    dish.optionGroups.forEach((g) => {
      const optId = chosenOptions[g.id];
      if (optId) {
        const opt = g.options.find((o) => o.id === optId);
        if (opt) sum += Number(opt.price);
      }
    });
    return sum;
  }

  const orderTotal = cart.reduce((lineSum, line) => {
    const combosTotal = line.combinations.reduce((cSum, c) => {
      return cSum + comboPrice(line.dish, c.chosenOptions) * c.quantity;
    }, 0);
    return lineSum + combosTotal;
  }, 0);

  function lineHasQuantityMismatch(line: CartLine): boolean {
    if (line.dish.optionGroups.length === 0) return false;
    const sum = line.combinations.reduce((s, c) => s + c.quantity, 0);
    return sum !== line.quantity;
  }

  function lineMissingRequiredGroup(line: CartLine): boolean {
    const reqGroups = line.dish.optionGroups.filter((g) => g.required);
    if (reqGroups.length === 0) return false;
    return line.combinations.some((c) => reqGroups.some((g) => !c.chosenOptions[g.id]));
  }

  const canSubmit =
    Boolean(employeeId) &&
    Boolean(deliveryDate) &&
    cart.length > 0 &&
    cart.every((line) => !lineHasQuantityMismatch(line) && !lineMissingRequiredGroup(line));

  async function handleSubmit(asDraft = false) {
    if (!token || !canSubmit) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const dto = {
        employeeId,
        deliveryDate,
        deliveryTime: deliveryTime || undefined,
        addressId: addressId || undefined,
        packagingType: packagingType || undefined,
        asDraft,
        lines: cart.map((line) => ({
          dishId: line.dish.id,
          quantity: line.quantity,
          combinations: line.combinations.map((c) => ({
            quantity: c.quantity,
            chosenOptions: Object.entries(c.chosenOptions)
              .filter(([, optId]) => Boolean(optId))
              .map(([groupId, optionId]) => ({ groupId, optionId })),
          })),
        })),
      };
      const created = await createOrder(token, dto);
      router.push(`/orders/${created.id}`);
    } catch (err: any) {
      setSubmitError(err.message ?? "Could not create order");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm font-semibold text-slate-600">Loading order form...</p>
      </main>
    );
  }

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create New Order</h1>
            <p className="mt-1 text-sm font-medium text-slate-600">Configure corporate meal order, dish portions, and options</p>
          </div>
          <button
            onClick={() => router.push("/orders")}
            className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-100"
          >
            Cancel
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left Column: Context & Order Settings */}
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4">
                Customer Details
              </h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="company-select" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Select Company
                  </label>
                  <select
                    id="company-select"
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-2xs focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                  >
                    <option value="">Select a company...</option>
                    {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                {companyId && (
                  <div>
                    <label htmlFor="employee-select" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                      Select Employee
                    </label>
                    <select
                      id="employee-select"
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-2xs focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                    >
                      <option value="">Select an employee...</option>
                      {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                  </div>
                )}

                {employeeId && (
                  <>
                    <div>
                      <label htmlFor="delivery-date" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                        Delivery Date
                      </label>
                      <input
                        id="delivery-date"
                        type="date"
                        value={deliveryDate}
                        onChange={(e) => setDeliveryDate(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-2xs focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                      />
                    </div>

                    <div>
                      <label htmlFor="delivery-time" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                        Delivery Time {!employee?.canChangeTime && "(Company Default)"}
                      </label>
                      <input
                        id="delivery-time"
                        type="time"
                        value={deliveryTime}
                        onChange={(e) => setDeliveryTime(e.target.value)}
                        disabled={!employee?.canChangeTime}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-2xs disabled:bg-slate-100 disabled:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                      />
                    </div>

                    {selectedCompany && selectedCompany.addresses.length > 0 && (
                      <div>
                        <label htmlFor="delivery-address" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                          Delivery Address {!employee?.canChooseAddress && "(Company Default)"}
                        </label>
                        <select
                          id="delivery-address"
                          value={addressId}
                          onChange={(e) => setAddressId(e.target.value)}
                          disabled={!employee?.canChooseAddress}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-2xs disabled:bg-slate-100 disabled:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                        >
                          <option value="">Default Address</option>
                          {selectedCompany.addresses.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                        </select>
                      </div>
                    )}

                    <div>
                      <label htmlFor="packaging-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                        Packaging {!employee?.canChangePackaging && "(Company Default)"}
                      </label>
                      <input
                        id="packaging-input"
                        type="text"
                        value={packagingType}
                        onChange={(e) => setPackagingType(e.target.value)}
                        disabled={!employee?.canChangePackaging}
                        placeholder="Company default packaging"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-2xs disabled:bg-slate-100 disabled:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Total / Submit Action Card */}
            {cart.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">Total Order Value</div>
                <div className="mt-1 text-2xl font-extrabold text-slate-900">₹{orderTotal.toFixed(2)}</div>
                
                {submitError && (
                  <div role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs font-bold text-rose-800">
                    ⚠️ {submitError}
                  </div>
                )}

                <div className="mt-4 flex flex-col gap-2">
                  <button
                    onClick={() => handleSubmit(false)}
                    disabled={!canSubmit || submitting}
                    className="cursor-pointer w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 focus-visible:ring-2 focus-visible:ring-emerald-600"
                  >
                    {submitting ? "Placing Order..." : "Place & Confirm Order"}
                  </button>
                  <button
                    onClick={() => handleSubmit(true)}
                    disabled={!canSubmit || submitting}
                    className="cursor-pointer w-full rounded-lg border border-slate-300 bg-white py-2 text-sm font-semibold text-slate-800 shadow-2xs hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-slate-900"
                  >
                    Save as Draft
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Menu Dishes & Cart Builder */}
          <div className="space-y-6 lg:col-span-2">
            {!employeeId ? (
              <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <p className="text-base font-semibold text-slate-800">No Employee Selected</p>
                <p className="mt-1 text-sm text-slate-600">Choose a company and employee on the left to load their custom pricing and menu.</p>
              </div>
            ) : !menu ? (
              <div className="flex h-64 items-center justify-center rounded-xl border border-slate-200 bg-white">
                <p className="text-sm font-semibold text-slate-600">Loading custom employee menu...</p>
              </div>
            ) : (
              <>
                {/* Menu Categories */}
                <div className="space-y-4">
                  {menu.map((category) => (
                    <div key={category.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                      <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 mb-3">
                        {category.name}
                      </h2>
                      <div className="divide-y divide-slate-100">
                        {category.items.map((dish) => (
                          <div key={dish.id} className="flex items-center justify-between py-3">
                            <div>
                              <h3 className="text-sm font-bold text-slate-900">{dish.name}</h3>
                              {dish.description && <p className="text-xs font-medium text-slate-600 mt-0.5">{dish.description}</p>}
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-sm font-bold text-slate-900">₹{Number(dish.price).toFixed(2)}</span>
                              <button
                                onClick={() => addDishToCart(dish)}
                                className="cursor-pointer rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-slate-900"
                              >
                                + Add
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Cart Items */}
                {cart.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                    <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4">
                      Configured Cart Items ({cart.length})
                    </h2>
                    <div className="space-y-4">
                      {cart.map((line) => (
                        <CartLineEditor
                          key={line.key}
                          line={line}
                          onQuantityChange={(q) => updateLineQuantity(line.key, q)}
                          onRemove={() => removeLine(line.key)}
                          onAddCombination={() => addCombination(line.key)}
                          onUpdateCombination={(i, patch) => updateCombination(line.key, i, patch)}
                          onRemoveCombination={(i) => removeCombination(line.key, i)}
                          comboPrice={comboPrice}
                          hasQuantityMismatch={lineHasQuantityMismatch(line)}
                          missingRequiredGroup={lineMissingRequiredGroup(line)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function CartLineEditor({
  line, onQuantityChange, onRemove, onAddCombination, onUpdateCombination, onRemoveCombination, comboPrice,
  hasQuantityMismatch, missingRequiredGroup,
}: {
  line: CartLine;
  onQuantityChange: (q: number) => void;
  onRemove: () => void;
  onAddCombination: () => void;
  onUpdateCombination: (i: number, patch: Partial<{ quantity: number; chosenOptions: Record<string, string> }>) => void;
  onRemoveCombination: (i: number) => void;
  comboPrice: (dish: MenuDish, chosenOptions: Record<string, string>) => number;
  hasQuantityMismatch: boolean;
  missingRequiredGroup: boolean;
}) {
  const comboSum = line.combinations.reduce((s, c) => s + c.quantity, 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="font-bold text-slate-900 text-sm">{line.dish.name}</div>
        <div className="flex items-center gap-3">
          <label htmlFor={`line-qty-${line.key}`} className="text-xs font-bold text-slate-700">Qty:</label>
          <input
            id={`line-qty-${line.key}`}
            type="number"
            min={1}
            value={line.quantity}
            onChange={(e) => onQuantityChange(parseInt(e.target.value, 10) || 1)}
            className="w-16 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm font-bold text-slate-900 shadow-2xs"
          />
          <button onClick={onRemove} className="cursor-pointer text-xs font-bold text-rose-700 hover:text-rose-900 hover:underline">
            Remove
          </button>
        </div>
      </div>

      {line.dish.optionGroups.length > 0 && (
        <div className="mt-3 space-y-3">
          {line.combinations.map((combo, i) => (
            <div key={i} className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Portion / Combo {i + 1}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600">Qty:</span>
                  <input
                    type="number"
                    min={1}
                    value={combo.quantity}
                    onChange={(e) => onUpdateCombination(i, { quantity: parseInt(e.target.value, 10) || 1 })}
                    className="w-14 rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs font-bold text-slate-900"
                  />
                  {line.combinations.length > 1 && (
                    <button onClick={() => onRemoveCombination(i)} className="cursor-pointer text-xs font-bold text-rose-700 hover:underline">
                      Delete
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {line.dish.optionGroups.map((group) => (
                  <div key={group.id}>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {group.name} {group.required && <span className="text-rose-600 font-bold">*</span>}
                    </label>
                    <select
                      value={combo.chosenOptions[group.id] ?? ""}
                      onChange={(e) =>
                        onUpdateCombination(i, { chosenOptions: { ...combo.chosenOptions, [group.id]: e.target.value } })
                      }
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-900 shadow-2xs"
                    >
                      <option value="">{group.required ? "Choose required..." : "None"}</option>
                      {group.options.map((o) => (
                        <option key={o.id} value={o.id}>{o.name} (+₹{Number(o.price).toFixed(2)})</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-right text-xs font-bold text-emerald-800">
                Subtotal: ₹{(comboPrice(line.dish, combo.chosenOptions) * combo.quantity).toFixed(2)}
              </div>
            </div>
          ))}
          <button onClick={onAddCombination} className="cursor-pointer text-xs font-bold text-emerald-700 hover:text-emerald-900 hover:underline">
            + Add Another Custom Combo Set
          </button>
        </div>
      )}

      {hasQuantityMismatch && (
        <p className="mt-2 text-xs font-bold text-rose-700">
          ⚠️ Combination quantities ({comboSum}) must equal total line quantity ({line.quantity})
        </p>
      )}
      {missingRequiredGroup && (
        <p className="mt-2 text-xs font-bold text-rose-700">
          ⚠️ Each combination requires a selected choice for mandatory option groups
        </p>
      )}
    </div>
  );
}
