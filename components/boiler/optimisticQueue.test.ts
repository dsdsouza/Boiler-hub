import { expect, it } from 'vitest';
import { OptimisticQueue } from './optimisticQueue';
const deferred = () => { let resolve!: (n: number) => void; const promise = new Promise<number>((r) => { resolve = r; }); return { promise, resolve }; };

it('serializes writes and replays newer optimistic changes over a whole-state response', async () => {
  const first = deferred(); const starts: string[] = []; let shown = 0;
  const queue = new OptimisticQueue<number>((n) => { shown = n; }, async () => 0, () => {});
  queue.replace(0);
  const one = queue.enqueue((n) => n + 1, async () => { starts.push('one'); return first.promise; });
  const two = queue.enqueue((n) => n + 10, async () => { starts.push('two'); return 11; });
  expect(shown).toBe(11);
  await Promise.resolve(); expect(starts).toEqual(['one']);
  first.resolve(1); await one;
  expect(shown).toBe(11); await two;
  expect(starts).toEqual(['one', 'two']); expect(shown).toBe(11);
});
it('commits a status-only response without discarding a preceding server result', async () => {
  let shown = { load: 0, status: 'open' };
  const queue = new OptimisticQueue<typeof shown>((n) => { shown = n; }, async () => shown, () => {});
  queue.replace(shown);
  const task = queue.enqueue((n) => ({ ...n, load: 1 }), async () => ({ load: 2, status: 'open' }));
  const status = queue.enqueue((n) => ({ ...n, status: 'away' }), async () => null);
  await task; expect(shown).toEqual({ load: 2, status: 'away' });
  await status; expect(shown).toEqual({ load: 2, status: 'away' });
});
it('rolls back only the failed change, keeps later intent and allows retry', async () => {
  let shown = 0; const errors: (string | null)[] = [];
  const queue = new OptimisticQueue<number>((n) => { shown = n; }, async () => 0, (e) => errors.push(e));
  queue.replace(0);
  const failed = queue.enqueue((n) => n + 1, async () => { throw new Error('Save failed'); });
  const later = queue.enqueue((n) => n + 10, async () => 10);
  expect(await failed).toBe(false); expect(shown).toBe(10);
  expect(await later).toBe(true); expect(shown).toBe(10);
  expect(errors).toEqual(['Save failed', null]);
});
it('falls back to confirmed state when both the write and recovery are offline', async () => {
  let shown = 0;
  const queue = new OptimisticQueue<number>((n) => { shown = n; }, async () => { throw new Error('Offline'); }, () => {});
  queue.replace(2);
  expect(await queue.enqueue((n) => n + 1, async () => { throw new Error('Offline'); })).toBe(false);
  expect(shown).toBe(2);
});
