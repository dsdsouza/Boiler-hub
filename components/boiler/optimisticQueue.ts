/** Preserve user intent while whole-boiler responses and owner writes are in flight. */
export class OptimisticQueue<T> {
  private confirmed: T | null = null;
  private pending: { apply: (data: T) => T }[] = [];
  private tail: Promise<unknown> = Promise.resolve();

  constructor(private publish: (data: T) => void, private recover: () => Promise<T>, private report: (error: string | null) => void) {}

  replace(data: T) { this.confirmed = data; this.emit(); }

  private emit() {
    if (this.confirmed !== null) this.publish(this.pending.reduce<T>((data, op) => op.apply(data), this.confirmed));
  }

  enqueue(apply: (data: T) => T, remote: () => Promise<T | null>): Promise<boolean> {
    const operation = { apply };
    this.pending.push(operation);
    this.emit();
    const finish = () => { this.pending = this.pending.filter((op) => op !== operation); this.emit(); };
    const result = this.tail.then(async () => {
      try {
        const fresh = await remote();
        // Status writes return no boiler. Commit their local status to the latest
        // confirmed response, then replay newer optimistic edits over that base.
        if (fresh !== null) this.confirmed = fresh;
        else if (this.confirmed !== null) this.confirmed = apply(this.confirmed);
        finish(); this.report(null);
        return true;
      } catch (error) {
        try { this.confirmed = await this.recover(); } catch { /* Keep the last confirmed state if offline. */ }
        finish(); this.report(error instanceof Error ? error.message : 'Something went wrong');
        return false;
      }
    });
    // Failed operations resolve false, so later saves can still run in order.
    this.tail = result;
    return result;
  }
}
