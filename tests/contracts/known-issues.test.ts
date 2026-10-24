import { describe, expect, it } from 'vitest';
import { parseDue } from '../../app/api/tasks/validate';

describe('documented task date contract: quarantined defects', () => {
  it.fails('QA-005: rejects ambiguous dates instead of silently changing their meaning', () => {
    expect(parseDue('01/02/2030')).toBe(false);
  });
  it.fails('QA-005: rejects numeric strings that are not ISO date-times', () => {
    expect(parseDue('1')).toBe(false);
  });
});
