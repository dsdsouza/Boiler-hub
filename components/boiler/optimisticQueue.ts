/** Preserve user intent while whole-boiler responses and owner writes are in flight. */
export class OptimisticQueue<T> {
  private confirmed: T | null = null;
  private pending: { apply: (data: T) => T }[] = [];
  private tail: Promise<unknown> = Promise.resolve();
  private generation = 0;
  current: T | null = null;

  constructor(private publish: (data: T) => void, private recover: () => Promise<T>, private report: (error: string | null) => void) {}

  replace(data: T) { this.confirmed = data; this.emit(); }
  reset() {
    this.generation++;
    this.confirmed = null;
    this.current = null;
    this.pending = [];
    this.tail = Promise.resolve();
  }

  private emit() {
    if (this.confirmed !== null) {
      this.current = this.pending.reduce<T>((data, op) => op.apply(data), this.confirmed);
      this.publish(this.current);
    }
  }

  enqueue(apply: (data: T) => T, remote: () => Promise<T | null>): Promise<boolean> {
    const operation = { apply };
    const generation = this.generation;
    this.pending.push(operation);
    this.emit();
    const finish = () => { this.pending = this.pending.filter((op) => op !== operation); this.emit(); };
    const result = this.tail.then(async () => {
      if (generation !== this.generation) return false;
      try {
        const fresh = await remote();
        if (generation !== this.generation) return false;
        // Status writes return no boiler. Commit their local status to the latest
        // confirmed response, then replay newer optimistic edits over that base.
        if (fresh !== null) this.confirmed = fresh;
        else if (this.confirmed !== null) this.confirmed = apply(this.confirmed);
        finish(); this.report(null);
        return true;
      } catch (error) {
        if (generation !== this.generation) return false;
        try { this.confirmed = await this.recover(); } catch { /* Keep the last confirmed state if offline. */ }
        if (generation !== this.generation) return false;
        finish(); this.report(error instanceof Error ? error.message : 'Something went wrong');
        return false;
      }
    });
    // Failed operations resolve false, so later saves can still run in order.
    this.tail = result;
    return result;
  }
}
