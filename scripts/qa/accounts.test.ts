import { describe, expect, it } from 'vitest';
import { accountBank } from './accounts.mjs';

describe('reusable QA account bank', () => {
  const bank = accountBank();
  it('covers 32 distinct identities, both roles, visibility levels, zones and an outsider', () => {
    expect(bank.users).toHaveLength(32);
    expect(new Set(bank.users.map((u) => u.id)).size).toBe(32);
    expect(new Set(bank.users.map((u) => u.email)).size).toBe(32);
    expect(bank.users.filter((u) => !u.team)).toHaveLength(1);
    expect(new Set(bank.users.map((u) => u.visibility))).toEqual(new Set(['hidden','lead','everyone']));
    expect(new Set(bank.users.map((u) => u.zone))).toEqual(new Set(['cool','working','hot','redline']));
    expect(bank.users.filter((u) => u.role === 'lead')).toHaveLength(4);
    expect(bank.users.some((u) => !u.hasSnapshot)).toBe(true);
    expect(bank.users.some((u) => u.ageHours > 72)).toBe(true);
  });
  it('contains no passwords, real inboxes, calendar events, or external tokens', () => {
    expect(bank.users.every((u) => u.email.endsWith('@example.test'))).toBe(true);
    for (const u of bank.users) expect(u).not.toHaveProperty('password');
  });
  it('rejects namespace values that could escape the reserved fixture identity', () => {
    for (const namespace of ['../../real', 'A@real.com', '', 'x'.repeat(33)]) expect(() => accountBank(namespace)).toThrow();
  });
  it('namespaces fixture IDs so separate test banks cannot overwrite one another', () => {
    expect(accountBank('one').users[0].id).not.toBe(accountBank('two').users[0].id);
  });
});
