/** One browser session's owner data. Nothing is written to browser storage. */
export class OwnerCache<T> {
  private owner: string | null = null;
  private value: T | null = null;
  private at = 0;
  private revision = 0;
  private pending: { revision: number; promise: Promise<T | null> } | null = null;
  private listeners = new Set<() => void>();
  private coordinators = new Map<string, { clear(): void }>();

  constructor(private maxAgeMs = 30_000, private now = () => Date.now()) {}

  read(owner: string): T | null {
    return this.owner === owner ? this.value : null;
  }
  isOwner(owner: string) { return this.owner === owner; }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  coordinator<Q extends { clear(): void }>(owner: string, create: () => Q): Q {
    if (!this.coordinators.has(owner)) this.coordinators.set(owner, create());
    return this.coordinators.get(owner) as Q;
  }

  private notify() { this.listeners.forEach(listener => listener()); }

  clear() {
    this.owner = null;
    this.value = null;
    this.at = 0;
    this.revision++;
    this.pending = null;
    this.coordinators.forEach(coordinator => coordinator.clear());
    this.notify();
  }

  invalidate() {
    this.at = 0;
    this.revision++;
  }

  remember(owner: string, value: T, confirmed = false) {
    if (this.owner !== owner) return;
    if (value === this.value && !confirmed) return;
    if (confirmed || value !== this.value) this.revision++;
    this.value = value;
    this.at = confirmed ? this.now() : 0;
    this.notify();
  }

  async load(owner: string, fetchData: () => Promise<T>, force = false): Promise<T | null> {
    if (this.owner !== owner) {
      this.clear();
      this.owner = owner;
    }
    if (!force && this.value !== null && this.at > 0 && this.now() - this.at < this.maxAgeMs) return this.value;
    if (!force && this.pending?.revision === this.revision) return this.pending.promise;
    if (force) this.revision++;
    const revision = this.revision;
    const promise = fetchData().then(value => {
      // A different owner or a newer mutation must never receive this response.
      if (this.owner !== owner || this.revision !== revision) return null;
      this.value = value;
      this.at = this.now();
      this.notify();
      return value;
    }).finally(() => {
      if (this.pending?.promise === promise) this.pending = null;
    });
    this.pending = { revision, promise };
    return promise;
  }
}
