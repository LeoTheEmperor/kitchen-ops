"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import {
  getCompanies, getEmployeesByCompany, getEmployeeMenu, createOrder,
  CompanySummary, EmployeeSummary, MenuCategory, MenuDish,
} from "@/lib/api";

// One line being built in the cart, before submission.
interface CartLine {
  key: string; // local id for list rendering
  dish: MenuDish;
  quantity: number;
  // one combination per distinct option choice set the user has added
  combinations: { quantity: number; chosenOptions: Record<string, string> }[]; // groupId -> optionId
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
        const combinations = line.combinations.map((c, i) => (i === comboIndex ? { ...c, ...patch } : c));
        return { ...line, combinations };
      }),
    );
  }

  function removeCombination(key: string, comboIndex: number) {
    setCart((prev) =>
      prev.map((line) =>
        line.key === key ? { ...line, combinations: line.combinations.filter((_, i) => i !== comboIndex) } : line,
      ),
    );
  }

  // Price preview computed client-side from the menu's resolved prices -
  // the server recomputes and is the actual source of truth at submit time.
  function comboPrice(dish: MenuDish, chosenOptions: Record<string, string>): number {
    let total = Number(dish.price);
    for (const group of dish.optionGroups) {
      const optionId = chosenOptions[group.id];
      if (!optionId) continue;
      const option = group.options.find((o) => o.id === optionId);
      if (option) total += Number(option.price);
    }
    return total;
  }

  function lineTotal(line: CartLine): number {
    return line.combinations.reduce((sum, c) => sum + comboPrice(line.dish, c.chosenOptions) * c.quantity, 0);
  }

  const orderTotal = cart.reduce((sum, line) => sum + lineTotal(line), 0);

  function combinationQuantitySum(line: CartLine): number {
    return line.combinations.reduce((sum, c) => sum + c.quantity, 0);
  }

  function lineHasQuantityMismatch(line: CartLine): boolean {
    return combinationQuantitySum(line) !== line.quantity;
  }

  function lineMissingRequiredGroup(line: CartLine): boolean {
    const requiredGroupIds = line.dish.optionGroups.filter((g) => g.required).map((g) => g.id);
    return line.combinations.some((combo) => requiredGroupIds.some((gid) => !combo.chosenOptions[gid]));
  }

  const canSubmit =
    employeeId &&
    deliveryDate &&
    cart.length > 0 &&
    cart.every((line) => !lineHasQuantityMismatch(line) && !lineMissingRequiredGroup(line));

  async function handleSubmit(asDraft: boolean) {
    if (!token || !employeeId || !deliveryDate) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const order = await createOrder(token, {
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
            chosenOptions: Object.entries(c.chosenOptions).map(([groupId, optionId]) => ({ groupId, optionId })),
          })),
        })),
      });
      router.push(`/orders/${order.id}`);
    } catch (err: any) {
      setSubmitError(err.message ?? "Could not create this order");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) return <main className="p-6">Loading...</main>;

  return (
    <AppShell user={user}>
      <h1 className="mb-4 text-lg font-semibold">New order</h1>

      <div className="grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: company/employee/delivery details */}
        <div className="space-y-4 lg:col-span-1">
          <div className="rounded-lg border bg-white p-4">
            <label className="block text-xs text-neutral-500">Company</label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            >
              <option value="">Select a company</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            {companyId && (
              <>
                <label className="mt-3 block text-xs text-neutral-500">Employee</label>
                <select
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                >
                  <option value="">Select an employee</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </>
            )}

            {employeeId && (
              <>
                <label className="mt-3 block text-xs text-neutral-500">Delivery date</label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                />

                <label className="mt-3 block text-xs text-neutral-500">
                  Delivery time {!employee?.canChangeTime && "(company default)"}
                </label>
                <input
                  type="time"
                  value={deliveryTime}
                  onChange={(e) => setDeliveryTime(e.target.value)}
                  disabled={!employee?.canChangeTime}
                  className="mt-1 w-full rounded border px-2 py-1.5 text-sm disabled:bg-neutral-100"
                />

                {selectedCompany && selectedCompany.addresses.length > 0 && (
                  <>
                    <label className="mt-3 block text-xs text-neutral-500">
                      Address {!employee?.canChooseAddress && "(company default)"}
                    </label>
                    <select
                      value={addressId}
                      onChange={(e) => setAddressId(e.target.value)}
                      disabled={!employee?.canChooseAddress}
                      className="mt-1 w-full rounded border px-2 py-1.5 text-sm disabled:bg-neutral-100"
                    >
                      <option value="">Default</option>
                      {selectedCompany.addresses.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                    </select>
                  </>
                )}

                <label className="mt-3 block text-xs text-neutral-500">
                  Packaging {!employee?.canChangePackaging && "(company default)"}
                </label>
                <input
                  type="text"
                  value={packagingType}
                  onChange={(e) => setPackagingType(e.target.value)}
                  disabled={!employee?.canChangePackaging}
                  placeholder="Company default"
                  className="mt-1 w-full rounded border px-2 py-1.5 text-sm disabled:bg-neutral-100"
                />
              </>
            )}
          </div>

          {/* Order summary / submit */}
          {cart.length > 0 && (
            <div className="rounded-lg border bg-white p-4">
              <h2 className="mb-2 font-medium">Order total</h2>
              <div className="text-xl font-semibold">₹{orderTotal.toFixed(2)}</div>
              {submitError && <p className="mt-2 text-sm text-red-600">{submitError}</p>}
              <div className="mt-3 flex flex-col gap-2">
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={!canSubmit || submitting}
                  className="rounded bg-black py-2 text-sm text-white disabled:opacity-40"
                >
                  {submitting ? "Placing..." : "Place order"}
                </button>
                <button
                  onClick={() => handleSubmit(true)}
                  disabled={!canSubmit || submitting}
                  className="rounded border py-2 text-sm disabled:opacity-40"
                >
                  Save as draft
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: menu + cart */}
        <div className="space-y-4 lg:col-span-2">
          {!employeeId ? (
            <p className="text-neutral-500">Select a company and employee to see their menu.</p>
          ) : !menu ? (
            <p className="text-neutral-500">Loading menu...</p>
          ) : (
            <>
              {menu.map((category) => (
                <div key={category.id} className="rounded-lg border bg-white p-4">
                  <h2 className="mb-3 font-medium">{category.name}</h2>
                  <div className="space-y-2">
                    {category.items.map((dish) => (
                      <div key={dish.id} className="flex items-center justify-between border-b py-2 last:border-0">
                        <div>
                          <div className="font-medium">{dish.name}</div>
                          {dish.description && <div className="text-sm text-neutral-500">{dish.description}</div>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm">₹{Number(dish.price).toFixed(2)}</span>
                          <button
                            onClick={() => addDishToCart(dish)}
                            className="rounded border px-3 py-1 text-sm hover:bg-neutral-50"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {cart.length > 0 && (
                <div className="rounded-lg border bg-white p-4">
                  <h2 className="mb-3 font-medium">Cart</h2>
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
    <div className="rounded border p-3">
      <div className="flex items-center justify-between">
        <div className="font-medium">{line.dish.name}</div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={line.quantity}
            onChange={(e) => onQuantityChange(parseInt(e.target.value, 10) || 1)}
            className="w-16 rounded border px-2 py-1 text-sm"
          />
          <button onClick={onRemove} className="text-sm text-red-600 hover:underline">Remove</button>
        </div>
      </div>

      {line.dish.optionGroups.length > 0 && (
        <div className="mt-2 space-y-2">
          {line.combinations.map((combo, i) => (
            <div key={i} className="rounded bg-neutral-50 p-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs text-neutral-500">Combination {i + 1}</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={combo.quantity}
                    onChange={(e) => onUpdateCombination(i, { quantity: parseInt(e.target.value, 10) || 1 })}
                    className="w-14 rounded border px-1 py-0.5 text-xs"
                  />
                  {line.combinations.length > 1 && (
                    <button onClick={() => onRemoveCombination(i)} className="text-xs text-red-600 hover:underline">
                      Remove
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {line.dish.optionGroups.map((group) => (
                  <div key={group.id}>
                    <label className="block text-xs text-neutral-500">
                      {group.name} {group.required && <span className="text-red-500">*</span>}
                    </label>
                    <select
                      value={combo.chosenOptions[group.id] ?? ""}
                      onChange={(e) =>
                        onUpdateCombination(i, { chosenOptions: { ...combo.chosenOptions, [group.id]: e.target.value } })
                      }
                      className="w-full rounded border px-1 py-0.5 text-xs"
                    >
                      <option value="">{group.required ? "Choose..." : "None"}</option>
                      {group.options.map((o) => (
                        <option key={o.id} value={o.id}>{o.name} (+₹{Number(o.price).toFixed(2)})</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="mt-1 text-right text-xs text-neutral-500">
                ₹{(comboPrice(line.dish, combo.chosenOptions) * combo.quantity).toFixed(2)}
              </div>
            </div>
          ))}
          <button onClick={onAddCombination} className="text-xs text-blue-600 hover:underline">
            + Add another combination
          </button>
        </div>
      )}

      {hasQuantityMismatch && (
        <p className="mt-2 text-xs text-red-600">
          Combination quantities ({comboSum}) must add up to the line quantity ({line.quantity})
        </p>
      )}
      {missingRequiredGroup && (
        <p className="mt-2 text-xs text-red-600">Every combination needs a choice for each required group</p>
      )}
    </div>
  );
}
