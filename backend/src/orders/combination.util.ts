// Pure validation logic for order-line combinations (4.1, 4.6).
// Kept framework-free so it's directly unit-testable.

export interface ChosenCombination {
  quantity: number;
  // one chosen optionId per required/optional group the customer selected from
  selectedOptionIdsByGroup: Record<string, string | null>; // groupId -> optionId (null if optional group, skipped)
}

export interface OptionGroupSpec {
  id: string;
  required: boolean;
}

export class CombinationValidationError extends Error {}

// "The combination quantities must add up exactly to the dish quantity" (4.1).
export function validateCombinationQuantities(lineQuantity: number, combinations: ChosenCombination[]): void {
  const total = combinations.reduce((sum, c) => sum + c.quantity, 0);
  if (total !== lineQuantity) {
    throw new CombinationValidationError(
      `Combination quantities (${total}) must add up exactly to the line quantity (${lineQuantity})`,
    );
  }
  if (combinations.some((c) => c.quantity <= 0)) {
    throw new CombinationValidationError('Each combination must have a positive quantity');
  }
}

// "Every combination must satisfy every required group" (4.1).
export function validateRequiredGroupsSatisfied(groups: OptionGroupSpec[], combinations: ChosenCombination[]): void {
  const requiredGroupIds = groups.filter((g) => g.required).map((g) => g.id);
  for (const combo of combinations) {
    for (const groupId of requiredGroupIds) {
      const selected = combo.selectedOptionIdsByGroup[groupId];
      if (!selected) {
        throw new CombinationValidationError(`A required option group (${groupId}) has no selection in one combination`);
      }
    }
  }
}

// Detects duplicate combinations (same option choices appearing twice as
// separate rows) - not explicitly required by spec, but merging them keeps
// the kitchen board (4.7) from showing two separate prep units for what's
// actually one distinct combination. Documented as an assumption in README.
export function combinationSignature(combo: ChosenCombination): string {
  const entries = Object.entries(combo.selectedOptionIdsByGroup).sort(([a], [b]) => a.localeCompare(b));
  return entries.map(([groupId, optionId]) => `${groupId}:${optionId ?? 'none'}`).join('|');
}

export function mergeDuplicateCombinations(combinations: ChosenCombination[]): ChosenCombination[] {
  const merged = new Map<string, ChosenCombination>();
  for (const combo of combinations) {
    const sig = combinationSignature(combo);
    const existing = merged.get(sig);
    if (existing) {
      existing.quantity += combo.quantity;
    } else {
      merged.set(sig, { ...combo });
    }
  }
  return Array.from(merged.values());
}
