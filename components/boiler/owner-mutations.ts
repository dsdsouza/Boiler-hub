import { OwnerCache } from './session-cache';
import { OptimisticQueue } from './optimisticQueue';

/** Keep one owner's saves in order even when its screen unmounts between writes. */
class OwnerMutations<T> {
  readonly queue: OptimisticQueue<T>;
  error: string | null = null;
  private listeners = new Set<(error: string | null) => void>();

  constructor(private cache: OwnerCache<T>, private owner: string, read: () => Promise<T>) {
    this.queue = new OptimisticQueue(
      value => cache.remember(owner, value),
      () => this.request(read),
      error => this.report(error),
    );
    cache.subscribe(() => {
      const value = cache.read(owner);
      // Own optimistic publications are already rebased. Reapplying them would
      // duplicate a pending add; only a new server/cache value is a new base.
      if (value !== null && value !== this.queue.current) this.queue.replace(value);
    });
    const value = cache.read(owner);
    if (value !== null) this.queue.replace(value);
  }

  clear() { this.queue.reset(); this.report(null); }
  subscribe(listener: (error: string | null) => void) {
    this.listeners.add(listener);
    listener(this.error);
    return () => { this.listeners.delete(listener); };
  }
  private report(error: string | null) { this.error = error; this.listeners.forEach(listener => listener(error)); }
  private async request<R>(remote: () => Promise<R>): Promise<R> {
    try { return await remote(); }
    catch (error) {
      if (this.cache.isOwner(this.owner) && error && typeof error === 'object' && 'status' in error && error.status === 401) {
        this.cache.clear();
        this.report(error instanceof Error ? error.message : 'Not signed in');
      }
      throw error;
    }
  }
  async enqueue(apply: (value: T) => T, remote: () => Promise<T | null>) {
    if (!this.cache.isOwner(this.owner)) return false;
    const saved = await this.queue.enqueue(apply, () => this.request(remote));
    const current = this.queue.current;
    if (saved && current !== null && this.cache.read(this.owner) === current) this.cache.remember(this.owner, current, true);
    return saved;
  }
}

export function ownerMutations<T>(cache: OwnerCache<T>, owner: string, read: () => Promise<T>) {
  return cache.coordinator(owner, () => new OwnerMutations(cache, owner, read));
}
