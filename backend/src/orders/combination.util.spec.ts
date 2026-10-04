import {
  validateCombinationQuantities,
  validateRequiredGroupsSatisfied,
  mergeDuplicateCombinations,
  CombinationValidationError,
} from './combination.util';

describe('validateCombinationQuantities', () => {
  it('passes when combination quantities sum exactly to the line quantity (spec example: 10 total, 6+4)', () => {
    expect(() =>
      validateCombinationQuantities(10, [
        { quantity: 6, selectedOptionIdsByGroup: { g1: 'brown-rice' } },
        { quantity: 4, selectedOptionIdsByGroup: { g1: 'jeera-rice' } },
      ]),
    ).not.toThrow();
  });

  it('throws when combination quantities do not add up to the line quantity', () => {
    expect(() =>
      validateCombinationQuantities(10, [
        { quantity: 6, selectedOptionIdsByGroup: {} },
        { quantity: 3, selectedOptionIdsByGroup: {} },
      ]),
    ).toThrow(CombinationValidationError);
  });

  it('throws on a zero or negative combination quantity', () => {
    expect(() =>
      validateCombinationQuantities(5, [
        { quantity: 0, selectedOptionIdsByGroup: {} },
        { quantity: 5, selectedOptionIdsByGroup: {} },
      ]),
    ).toThrow(CombinationValidationError);
  });
});

describe('validateRequiredGroupsSatisfied', () => {
  const groups = [
    { id: 'protein', required: true },
    { id: 'sauce', required: false },
  ];

  it('passes when every combination has a selection for each required group', () => {
    expect(() =>
      validateRequiredGroupsSatisfied(groups, [
        { quantity: 1, selectedOptionIdsByGroup: { protein: 'paneer' } },
      ]),
    ).not.toThrow();
  });

  it('throws when a required group has no selection', () => {
    expect(() =>
      validateRequiredGroupsSatisfied(groups, [
        { quantity: 1, selectedOptionIdsByGroup: { protein: null } },
      ]),
    ).toThrow(CombinationValidationError);
  });

  it('does not require a selection for an optional group', () => {
    expect(() =>
      validateRequiredGroupsSatisfied(groups, [
        {
          quantity: 1,
          selectedOptionIdsByGroup: { protein: 'tofu', sauce: null },
        },
      ]),
    ).not.toThrow();
  });
});

describe('mergeDuplicateCombinations', () => {
  it('merges two combinations with identical option choices into one, summing quantity', () => {
    const merged = mergeDuplicateCombinations([
      { quantity: 3, selectedOptionIdsByGroup: { protein: 'paneer' } },
      { quantity: 2, selectedOptionIdsByGroup: { protein: 'paneer' } },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].quantity).toBe(5);
  });

  it('keeps distinct combinations separate', () => {
    const merged = mergeDuplicateCombinations([
      { quantity: 6, selectedOptionIdsByGroup: { rice: 'brown-rice' } },
      { quantity: 4, selectedOptionIdsByGroup: { rice: 'jeera-rice' } },
    ]);
    expect(merged).toHaveLength(2);
  });
});
