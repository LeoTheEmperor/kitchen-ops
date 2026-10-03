import { calculateCutoffInstant, isPastCutoff } from './cutoff.util';
import { DateTime } from 'luxon';

describe('calculateCutoffInstant', () => {
  const baseInputs = {
    cutoffDays: 2,
    cutoffTime: '16:00',
    kitchenWorkingDays: [1, 2, 3, 4, 5], // Mon-Fri
    kitchenHolidays: [] as string[],
    timezone: 'Asia/Kolkata',
  };

  it('a Wednesday delivery with 2 working-day cutoff locks Monday 16:00 (example from spec)', () => {
    // 2026-10-07 is a Wednesday
    const result = calculateCutoffInstant({ ...baseInputs, deliveryDate: '2026-10-07' });
    expect(result.toFormat('yyyy-MM-dd HH:mm')).toBe('2026-10-05 16:00'); // the preceding Monday
  });

  it('skips weekends when counting back working days', () => {
    // 2026-10-05 is a Monday; 2 working days back should skip Sat/Sun entirely
    const result = calculateCutoffInstant({ ...baseInputs, deliveryDate: '2026-10-05' });
    // working days back from Monday: Friday (1), Thursday (2)
    expect(result.toFormat('yyyy-MM-dd')).toBe('2026-10-01'); // Thursday
  });

  it('skips kitchen holidays when counting back, even if they fall on a working day', () => {
    const result = calculateCutoffInstant({
      ...baseInputs,
      deliveryDate: '2026-10-07', // Wednesday
      kitchenHolidays: ['2026-10-05'], // Monday is a kitchen holiday
    });
    // normally would land on Monday 10-05, but that's a holiday, so skip further back to Friday 10-02
    expect(result.toFormat('yyyy-MM-dd')).toBe('2026-10-02');
  });

  it('isPastCutoff correctly compares against "now"', () => {
    const inputs = { ...baseInputs, deliveryDate: '2026-10-07' };
    const beforeCutoff = DateTime.fromISO('2026-10-05T10:00:00', { zone: 'Asia/Kolkata' });
    const afterCutoff = DateTime.fromISO('2026-10-05T17:00:00', { zone: 'Asia/Kolkata' });
    expect(isPastCutoff(inputs, beforeCutoff)).toBe(false);
    expect(isPastCutoff(inputs, afterCutoff)).toBe(true);
  });

  it('is correct regardless of what timezone "now" is constructed in (non-IST input)', () => {
    const inputs = { ...baseInputs, deliveryDate: '2026-10-07' };
    // 2026-10-05 16:00 IST == 2026-10-05 10:30 UTC
    const utcMoment = DateTime.fromISO('2026-10-05T10:30:00Z');
    expect(isPastCutoff(inputs, utcMoment)).toBe(true);
    const utcMomentBefore = DateTime.fromISO('2026-10-05T10:00:00Z');
    expect(isPastCutoff(inputs, utcMomentBefore)).toBe(false);
  });
});
