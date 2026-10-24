import { describe, expect, it, vi } from "vitest";
import { computePressure } from "@/lib/pressure/compute";
import { fetchGithub, githubAdapter, mapGithub, sizeFromLabels, type GhIssue } from "./github";
import { SourceError } from "./types";

const NOW = new Date("2026-10-26T12:00:00Z");
const SRC = "33333333-3333-4333-8333-333333333333";
const DAY = 86_400_000;
const iso = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

const issue = (n: number, title: string, extra: Partial<GhIssue> = {}): GhIssue => ({
  node_id: `N_${n}`,
  number: n,
  title,
  html_url: `https://github.com/acme/api/issues/${n}`,
  repository_url: "https://api.github.com/repos/acme/api",
  labels: [],
  milestone: null,
  ...extra,
});
const pr = (n: number, title: string, extra: Partial<GhIssue> = {}) =>
  issue(n, title, { html_url: `https://github.com/acme/api/pull/${n}`, pull_request: { merged_at: null }, ...extra });

/** Routes GitHub REST paths to canned JSON; anything unknown is a 404. */
function fakeGithub(routes: Record<string, unknown>, overrides: Record<string, () => Response> = {}) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const key = url.pathname === "/search/issues" ? `search ${url.searchParams.get("q")}` : `${url.pathname}${url.search}`;
    for (const [match, respond] of Object.entries(overrides)) if (key.includes(match)) return respond();
    for (const [match, body] of Object.entries(routes)) {
      if (key.startsWith(match)) return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response("{}", { status: 404 });
  }) as unknown as typeof fetch;
}

const SINCE = "2026-10-24T12:00:00Z";
const routes = {
  "/user": { login: "maya" },
  "search is:open is:issue archived:false assignee:maya": {
    items: [
      issue(1, "Fix login", { labels: [{ name: "size:L" }], milestone: { due_on: "2026-10-30T07:00:00Z" } }),
      issue(2, "Docs typo", { labels: ["size:S"] }),
      issue(3, "Unlabelled bug"),
    ],
  },
  "search is:open is:pr archived:false review-requested:maya": { items: [pr(10, "Add caching")] },
  "search is:open is:pr archived:false author:maya": { items: [pr(20, "Red build"), pr(21, "Green build"), pr(22, "Rerun went green")] },
  [`search is:closed is:issue reason:completed assignee:maya closed:>=${SINCE}`]: { items: [issue(4, "Shipped thing", { closed_at: iso(-5 * 3_600_000), labels: [{ name: "size:M" }] })] },
  [`search is:pr is:merged author:maya merged:>=${SINCE}`]: { items: [pr(23, "Merged feature", { pull_request: { merged_at: iso(-DAY) }, closed_at: iso(-DAY) })] },
  "/repos/acme/api/pulls/20": { head: { sha: "sha20" } },
  "/repos/acme/api/pulls/21": { head: { sha: "sha21" } },
  "/repos/acme/api/pulls/22": { head: { sha: "sha22" } },
  "/repos/acme/api/actions/runs?head_sha=sha20": {
    workflow_runs: [
      { workflow_id: 1, run_number: 5, conclusion: "failure" },
      { workflow_id: 2, run_number: 9, conclusion: "success" },
    ],
  },
  "/repos/acme/api/actions/runs?head_sha=sha21": { workflow_runs: [{ workflow_id: 1, run_number: 6, conclusion: "success" }] },
  "/repos/acme/api/actions/runs?head_sha=sha22": {
    workflow_runs: [
      { workflow_id: 1, run_number: 7, conclusion: "failure" },
      { workflow_id: 1, run_number: 8, conclusion: "success" },
    ],
  },
};

describe("GitHub adapter (mocked API)", () => {
  it("maps assigned issues, review requests, failing CI and recent completions", async () => {
    const items = await githubAdapter.fetchItems(
      { id: SRC, kind: "github", label: "GitHub", coursework: false, secret: "github_pat_test" },
      { now: NOW, timeZone: "UTC", fetchImpl: fakeGithub(routes) },
    );
    const by = new Map(items.map((i) => [i.title, i]));

    expect(by.get("#1 Fix login")).toMatchObject({ kind: "task", source: "github", size: "L", due: "2026-10-30T07:00:00Z", doneAt: null, url: "https://github.com/acme/api/issues/1" });
    expect(by.get("#2 Docs typo")).toMatchObject({ size: "S", due: iso(7 * DAY) });
    expect(by.get("#3 Unlabelled bug")).toMatchObject({ size: "M", due: iso(7 * DAY) });
    expect(by.get("Review: #10 Add caching")).toMatchObject({ size: "S", due: iso(2 * DAY) });
    expect(by.get("Fix CI: #20")).toMatchObject({ size: "S", due: iso(DAY), url: "https://github.com/acme/api/pull/20/checks" });
    expect(by.has("Fix CI: #21")).toBe(false);
    expect(by.has("Fix CI: #22")).toBe(false); // latest run of that workflow passed
    expect(by.get("#4 Shipped thing")).toMatchObject({ doneAt: iso(-5 * 3_600_000), size: "M" });
    expect(by.get("#23 Merged feature")).toMatchObject({ doneAt: iso(-DAY) });

    for (const i of items) {
      expect(i.itemKey).toMatch(/^[0-9a-f]{64}$/);
      expect(i.id).toBe(`${SRC}:${i.itemKey}`);
    }
    // Every item is labelled with its repo.
    expect(new Set(items.map((i) => i.course))).toEqual(new Set(["acme/api"]));
    // Completed items vent.
    const done = items.filter((i) => i.doneAt);
    expect(computePressure(done, NOW).raw).toBeLessThan(0);
  });

  it("an issue closed in the window wins over an open copy, keeping one key", () => {
    const closed = issue(1, "Fix login", { closed_at: iso(-3_600_000) });
    const items = mapGithub({ assigned: [issue(1, "Fix login")], reviewRequested: [], failingCi: [], closedAssigned: [closed], mergedMine: [] }, SRC, NOW);
    expect(items).toHaveLength(1);
    expect(items[0]!.doneAt).toBe(iso(-3_600_000));
  });

  it("skips CI when the token has no Actions access instead of failing", async () => {
    const fetchImpl = fakeGithub(routes, { "/actions/runs": () => new Response("{}", { status: 403 }) });
    const snap = await fetchGithub("tok", NOW, fetchImpl);
    expect(snap.failingCi).toEqual([]);
    expect(snap.assigned).toHaveLength(3);
  });

  it("reports rate limits with the reset time", async () => {
    const reset = Math.floor(Date.UTC(2026, 9, 26, 12, 32) / 1000);
    const limited = () => new Response("{}", { status: 403, headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(reset) } });
    await expect(fetchGithub("tok", NOW, fakeGithub(routes, { "search ": limited }))).rejects.toThrow("GitHub rate limit reached, retrying after 12:32 UTC");
    // A rate limit on the CI calls is not swallowed either.
    await expect(fetchGithub("tok", NOW, fakeGithub(routes, { "/actions/runs": limited }))).rejects.toThrow(/rate limit/);
    const secondary = () => new Response("{}", { status: 429, headers: { "retry-after": "60" } });
    await expect(fetchGithub("tok", NOW, fakeGithub(routes, { "/user": secondary }))).rejects.toThrow(/rate limit/);
  });

  it("explains a bad token", async () => {
    const fetchImpl = fakeGithub(routes, { "/user": () => new Response("{}", { status: 401 }) });
    const err = await fetchGithub("bad", NOW, fetchImpl).catch((e) => e);
    expect(err).toBeInstanceOf(SourceError);
    expect(err.message).toMatch(/rejected the token/);
  });

  it("reads size labels in a few spellings", () => {
    expect([[{ name: "size:S" }], [{ name: "Size: L" }], ["size/m"], [{ name: "bug" }], undefined].map((l) => sizeFromLabels(l))).toEqual(["S", "L", "M", "M", "M"]);
  });
});
