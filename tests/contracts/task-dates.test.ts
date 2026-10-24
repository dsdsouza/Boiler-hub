import { describe, expect, it } from 'vitest';
import { parseDue } from '../../app/api/tasks/validate';

describe('documented task date contract', () => {
  it('QA-005: rejects ambiguous dates instead of silently changing their meaning', () => {
    expect(parseDue('01/02/2030')).toBe(false);
  });
  it('QA-005: rejects numeric strings that are not ISO date-times', () => {
    expect(parseDue('1')).toBe(false);
  });
});

// Validate the calendar too: Date.parse silently normalizes February 30.
it.each(['2030-02-30T12:00:00Z', '2025-02-29T12:00:00Z', '2030-01-01',
  '2030-01-01T24:00:00Z', '2030-01-01T12:00:00', '2030-01-01T12:00:00+25:00', ''])('rejects invalid ISO input %s', (value) => {
  expect(parseDue(value)).toBe(false);
});
it('accepts real ISO timestamps and preserves the optional-date contract', () => {
  expect(parseDue('2028-02-29T12:00:00.123Z')).toBe('2028-02-29T12:00:00.123Z');
  expect(parseDue('2030-01-02T12:00:00-05:00')).toBe('2030-01-02T17:00:00.000Z');
  expect(parseDue(null)).toBeNull();
  expect(parseDue(undefined)).toBeUndefined();
});
