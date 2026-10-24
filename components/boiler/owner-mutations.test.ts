import { expect, it } from 'vitest';
import { OwnerCache } from './session-cache';
import { ownerMutations } from './owner-mutations';

type Data = { status: string; tasks: string[] };
const base = (): Data => ({ status: 'open', tasks: [] });
const deferred = <T>() => { let resolve!: (value: T) => void; let reject!: (reason: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

it('retains the same owner queue when the first load initializes its cache', async () => {
  const cache = new OwnerCache<Data>();
  const first = ownerMutations(cache, 'owner', async () => base());
  await cache.load('owner', async () => base());
  const second = ownerMutations(cache, 'owner', async () => base());
  expect(first).toBe(second);
  expect(first.queue.current).toEqual(base());
});
it('a returning screen shares the pending writes and preserves the newer status', async () => {
  const cache = new OwnerCache<Data>(); await cache.load('owner', async () => base());
  const first = ownerMutations(cache, 'owner', async () => base()), response = deferred<Data>();
  const a = first.enqueue(d => ({ ...d, tasks: [...d.tasks, 'task'] }), () => response.promise);
  const returning = ownerMutations(cache, 'owner', async () => base());
  let secondStarted = false;
  const b = returning.enqueue(d => ({ ...d, status: 'away' }), async () => { secondStarted = true; return null; });
  expect(cache.read('owner')).toEqual({ status: 'away', tasks: ['task'] });
  expect(secondStarted).toBe(false);
  response.resolve({ status: 'open', tasks: ['task'] });
  expect(await a).toBe(true); expect(await b).toBe(true);
  expect(cache.read('owner')).toEqual({ status: 'away', tasks: ['task'] });
});
it('a fresh server read replays an outstanding add exactly once', async () => {
  const cache = new OwnerCache<Data>(); await cache.load('owner', async () => base());
  const saves = ownerMutations(cache, 'owner', async () => base()), response = deferred<Data>();
  const saved = saves.enqueue(d => ({ ...d, tasks: [...d.tasks, 'pending'] }), () => response.promise);
  await cache.load('owner', async () => ({ status: 'open', tasks: ['external'] }), true);
  expect(cache.read('owner')?.tasks).toEqual(['external', 'pending']);
  response.resolve({ status: 'open', tasks: ['external', 'pending'] }); await saved;
  expect(cache.read('owner')?.tasks).toEqual(['external', 'pending']);
});
it('clearing a session prevents a late response from republishing private data', async () => {
  const cache = new OwnerCache<Data>(); await cache.load('owner', async () => base());
  const saves = ownerMutations(cache, 'owner', async () => base()), response = deferred<Data>();
  const saved = saves.enqueue(d => ({ ...d, status: 'away' }), () => response.promise);
  await Promise.resolve(); cache.clear(); response.resolve({ status: 'private-old-owner', tasks: ['private'] });
  expect(await saved).toBe(false);
  expect(cache.read('owner')).toBeNull(); expect(saves.queue.current).toBeNull();
});
it('an unauthorized save clears retained data and reports the error to the active screen', async () => {
  const cache = new OwnerCache<Data>(); await cache.load('owner', async () => base());
  const saves = ownerMutations(cache, 'owner', async () => base()); const errors: (string | null)[] = [];
  saves.subscribe(error => errors.push(error));
  expect(await saves.enqueue(d => ({ ...d, status: 'away' }), async () => { throw Object.assign(new Error('Not signed in'), { status: 401 }); })).toBe(false);
  expect(cache.read('owner')).toBeNull(); expect(errors.at(-1)).toBe('Not signed in');
});
it('a late failure from a previous owner cannot clear the new owner cache', async () => {
  const cache = new OwnerCache<Data>(); await cache.load('first', async () => base());
  const saves = ownerMutations(cache, 'first', async () => base()), response = deferred<Data>();
  const saved = saves.enqueue(d => ({ ...d, status: 'away' }), () => response.promise);
  await Promise.resolve(); await cache.load('second', async () => ({ status: 'new owner', tasks: [] }));
  response.reject(Object.assign(new Error('Old session expired'), { status: 401 }));
  expect(await saved).toBe(false); expect(cache.read('second')?.status).toBe('new owner');
});
