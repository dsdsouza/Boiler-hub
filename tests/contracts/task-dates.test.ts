import { describe, expect, it } from 'vitest';
import { parseDue } from '../../app/api/tasks/validate';

describe('task date contract', () => {
  it('QA-005: rejects ambiguous dates instead of silently changing their meaning', () => {
    expect(parseDue('01/02/2030')).toBe(false);
  });
  it('QA-005: rejects numeric strings that are not ISO date-times', () => {
    expect(parseDue('1')).toBe(false);
  });
  it.each(['2030-02-30T12:00:00Z', '2030-02-29T12:00:00Z', '2100-02-29T12:00:00Z', '2030-04-31T12:00:00Z', '2030-01-02', '2030-01-02T12:00:00', '2030-01-02T24:00:00Z', '2030-01-02T12:00:00+24:00', '', ' 2030-01-02T12:00:00Z', 1])('rejects invalid or incomplete timestamp %s', (value) => {
    expect(parseDue(value)).toBe(false);
  });
  it.each(['2030-01-02T12:00:00Z', '2032-02-29T12:00:00.123Z', '2000-02-29T12:00:00+05:30', '2030-01-02T12:00-04:00'])('normalizes valid ISO timestamp %s', (value) => {
    expect(parseDue(value)).toBe(new Date(value).toISOString());
  });
  it('preserves omitted and explicitly undated values', () => {
    expect(parseDue(undefined)).toBeUndefined();
    expect(parseDue(null)).toBeNull();
  });
});
