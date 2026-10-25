import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { observePipUser } from "./pip-auth";

type Auth = Parameters<typeof observePipUser>[0];
type Result = Awaited<ReturnType<Auth["getUser"]>>;
function fixture() {
  let changed!: Parameters<Auth["onAuthStateChange"]>[0];
  const unsubscribe = vi.fn();
  const getUser = vi.fn<Auth["getUser"]>().mockResolvedValue({ data: { user: null }, error: null });
  const auth: Auth = { getUser, onAuthStateChange(callback) { changed = callback; return { data: { subscription: { unsubscribe } } }; } };
  const visible = vi.fn();
  const stop = observePipUser(auth, visible);
  return { getUser, visible, stop, unsubscribe, change: (id: string | null) => changed(id ? "SIGNED_IN" : "SIGNED_OUT", id ? { user: { id } } : null) };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("keeps Pip hidden while verifying and reveals only the verified user", async () => {
  const f = fixture();
  f.getUser.mockResolvedValue({ data: { user: { id: "verified" } }, error: null });
  expect(f.visible).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(0);
  expect(f.visible).toHaveBeenLastCalledWith("verified");
  f.stop();
});

it("does not trust the user in a saved session when verification rejects it", async () => {
  const f = fixture();
  f.getUser.mockResolvedValue({ data: { user: { id: "cached" } }, error: new Error("Revoked") });
  f.change("cached");
  await vi.advanceTimersByTimeAsync(0);
  expect(f.visible.mock.calls.every(([id]) => id === null)).toBe(true);
  f.stop();
});

it("hides Pip when auth is unavailable", async () => {
  const f = fixture();
  f.getUser.mockRejectedValue(new Error("Offline"));
  await vi.advanceTimersByTimeAsync(0);
  expect(f.visible).toHaveBeenLastCalledWith(null);
  f.stop();
});

it("hides immediately on sign-out and ignores an earlier verification completing late", async () => {
  const f = fixture();
  let resolve!: (value: Result) => void;
  f.getUser.mockReturnValue(new Promise((done) => { resolve = done; }));
  await vi.advanceTimersByTimeAsync(0);
  f.change(null);
  expect(f.visible).toHaveBeenLastCalledWith(null);
  resolve({ data: { user: { id: "old-account" } }, error: null });
  await vi.advanceTimersByTimeAsync(0);
  expect(f.visible.mock.calls).toEqual([[null]]);
  f.stop();
});

it("clears the prior identity before checking a different account", async () => {
  const f = fixture();
  f.getUser.mockResolvedValue({ data: { user: { id: "first" } }, error: null });
  await vi.advanceTimersByTimeAsync(0);
  f.change("second");
  expect(f.visible).toHaveBeenLastCalledWith(null);
  f.getUser.mockResolvedValue({ data: { user: { id: "second" } }, error: null });
  await vi.advanceTimersByTimeAsync(0);
  expect(f.visible).toHaveBeenLastCalledWith("second");
  f.stop();
});

it("cancels scheduled work and stops listening when unmounted", async () => {
  const f = fixture();
  f.stop();
  await vi.advanceTimersByTimeAsync(0);
  expect(f.getUser).not.toHaveBeenCalled();
  expect(f.visible).not.toHaveBeenCalled();
  expect(f.unsubscribe).toHaveBeenCalledOnce();
});
