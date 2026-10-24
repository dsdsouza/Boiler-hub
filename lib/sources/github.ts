import type { Size } from "@/lib/types";
import { sha256 } from "@/lib/google/normalize";
import { SourceError, sourceItemId, type SourceAdapter, type SourceItem } from "./types";

// GitHub (personal access token, read-only). Fetched live each sync, never stored.
//   open issues assigned to me          -> task, size from size:S/M/L labels (else M), due = milestone due_on (else +7d)
//   PRs with review requested from me   -> S task, due +2d
//   my open PRs with failing Actions    -> S task "Fix CI: #n", due +1d
//   issues assigned to me closed as completed, or my PRs merged, in the last 48h -> completed tasks (they vent)

const API = "https://api.github.com";
const TIMEOUT_MS = 10_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_MS = 2 * DAY_MS;
/** Open PRs whose Actions runs we check per sync (2 calls each). */
export const MAX_CI_PRS = 10;
const FAILED = new Set(["failure", "timed_out", "startup_failure"]);
const SEARCH_PAGE_SIZE = 100;
const SEARCH_LIMIT = 1000;

class GithubHttpError extends SourceError {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** The subset of a search/issues result we read. */
export interface GhIssue {
  node_id: string;
  number: number;
  title: string;
  html_url: string;
  repository_url: string;
  labels?: ({ name?: string } | string)[];
  milestone?: { due_on?: string | null } | null;
  closed_at?: string | null;
  pull_request?: { merged_at?: string | null } | null;
}

export interface GhSnapshot {
  assigned: GhIssue[];
  reviewRequested: GhIssue[];
  /** My open PRs whose latest Actions run (per workflow) failed. */
  failingCi: GhIssue[];
  closedAssigned: GhIssue[];
  mergedMine: GhIssue[];
}

/** "owner/repo" from https://api.github.com/repos/owner/repo */
export function repoOf(issue: Pick<GhIssue, "repository_url">): string {
  return issue.repository_url.replace(/^https:\/\/api\.github\.com\/repos\//, "");
}

export function sizeFromLabels(labels: GhIssue["labels"]): Size {
  for (const l of labels ?? []) {
    const name = (typeof l === "string" ? l : l.name ?? "").trim().toLowerCase();
    const m = name.match(/^size\s*[:/]\s*([sml])$/);
    if (m) return m[1]!.toUpperCase() as Size;
  }
  return "M";
}

/** Map GitHub results to source items. Pure apart from hashing. */
export function mapGithub(snap: GhSnapshot, sourceId: string, now: Date): SourceItem[] {
  const t = now.getTime();
  const at = (ms: number) => new Date(t + ms).toISOString();
  const byKey = new Map<string, SourceItem>();
  const add = (i: GhIssue, external: string, item: Omit<SourceItem, "id" | "itemKey" | "sourceId" | "source" | "kind" | "course">) => {
    const itemKey = sha256(external);
    if (byKey.has(itemKey)) return;
    byKey.set(itemKey, { id: sourceItemId(sourceId, itemKey), itemKey, sourceId, source: "github", kind: "task", course: repoOf(i), ...item });
  };
  // The repo is the item's course label, so titles carry only the number.
  const ref = (i: GhIssue) => `#${i.number}`;

  // Completed first, so an item closed in the window wins over a stale open copy.
  for (const i of snap.closedAssigned) {
    add(i, `issue:${i.node_id}`, { title: `${ref(i)} ${i.title}`, size: sizeFromLabels(i.labels), due: i.milestone?.due_on ?? i.closed_at ?? undefined, doneAt: i.closed_at ?? at(0), url: i.html_url });
  }
  for (const i of snap.mergedMine) {
    const doneAt = i.pull_request?.merged_at ?? i.closed_at ?? at(0);
    add(i, `pr:${i.node_id}`, { title: `${ref(i)} ${i.title}`, size: sizeFromLabels(i.labels), due: doneAt, doneAt, url: i.html_url });
  }
  for (const i of snap.assigned) {
    add(i, `issue:${i.node_id}`, { title: `${ref(i)} ${i.title}`, size: sizeFromLabels(i.labels), due: i.milestone?.due_on ?? at(7 * DAY_MS), doneAt: null, url: i.html_url });
  }
  for (const i of snap.reviewRequested) {
    add(i, `review:${i.node_id}`, { title: `Review: ${ref(i)} ${i.title}`, size: "S", due: at(2 * DAY_MS), doneAt: null, url: i.html_url });
  }
  for (const i of snap.failingCi) {
    add(i, `ci:${i.node_id}`, { title: `Fix CI: ${ref(i)}`, size: "S", due: at(1 * DAY_MS), doneAt: null, url: `${i.html_url}/checks` });
  }
  return [...byKey.values()];
}

// --- REST client ---

type Get = <T>(path: string) => Promise<T>;

function client(token: string, fetchImpl: typeof fetch, signal: AbortSignal): Get {
  return async <T>(path: string): Promise<T> => {
    let res: Response;
    try {
      res = await fetchImpl(`${API}${path}`, {
        signal,
        cache: "no-store",
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/vnd.github+json",
          "x-github-api-version": "2022-11-28",
          "user-agent": "Boilerplate",
        },
      });
    } catch {
      if (signal.aborted) throw new SourceError("GitHub took longer than 10 seconds to respond");
      throw new SourceError("Could not reach GitHub");
    }
    if (res.ok) return (await res.json()) as T;
    throw githubError(res);
  };
}

/** A user-facing error for a failed GitHub response. Rate limits name the time to retry. */
export function githubError(res: Response): SourceError {
  const remaining = res.headers.get("x-ratelimit-remaining");
  const reset = Number(res.headers.get("x-ratelimit-reset"));
  const retryAfter = Number(res.headers.get("retry-after"));
  if (res.status === 429 || (res.status === 403 && (remaining === "0" || retryAfter > 0))) {
    const when = remaining === "0" && reset > 0 ? new Date(reset * 1000) : retryAfter > 0 ? new Date(Date.now() + retryAfter * 1000) : null;
    return new SourceError(when ? `GitHub rate limit reached, retrying after ${hhmm(when)} UTC` : "GitHub rate limit reached, retrying shortly");
  }
  if (res.status === 401) return new SourceError("GitHub rejected the token. It may have expired or been revoked");
  if (res.status === 403) return new GithubHttpError("GitHub refused the request. Check the token's read permissions", res.status);
  return new GithubHttpError(`GitHub returned ${res.status}`, res.status);
}

function hhmm(d: Date) {
  return d.toISOString().slice(11, 16);
}

async function search(get: Get, q: string, limit = SEARCH_LIMIT): Promise<GhIssue[]> {
  const items: GhIssue[] = [];
  for (let page = 1; items.length < limit; page++) {
    const r = await get<{ items?: GhIssue[]; total_count?: number; incomplete_results?: boolean }>(
      `/search/issues?q=${encodeURIComponent(q)}&per_page=${SEARCH_PAGE_SIZE}&sort=updated&page=${page}`,
    );
    if (r.incomplete_results) throw new SourceError("GitHub returned incomplete results. Try syncing again shortly");
    if (limit === SEARCH_LIMIT && (r.total_count ?? 0) > SEARCH_LIMIT) {
      throw new SourceError("GitHub matched more than 1,000 items, beyond its search limit. Use a token limited to fewer repositories");
    }
    const found = r.items ?? [];
    items.push(...found);
    if (found.length < SEARCH_PAGE_SIZE || items.length >= (r.total_count ?? Infinity)) break;
  }
  return items.slice(0, limit);
}

/** Whether the PR's latest Actions run of any workflow failed. Missing Actions access counts as not failing. */
async function ciFailing(get: Get, pr: GhIssue): Promise<boolean> {
  const repo = repoOf(pr);
  try {
    const detail = await get<{ head?: { sha?: string } }>(`/repos/${repo}/pulls/${pr.number}`);
    const sha = detail.head?.sha;
    if (!sha) return false;
    const runs = await get<{ workflow_runs?: { workflow_id: number; run_number: number; conclusion: string | null }[] }>(
      `/repos/${repo}/actions/runs?head_sha=${sha}&per_page=50`,
    );
    const latest = new Map<number, { run_number: number; conclusion: string | null }>();
    for (const run of runs.workflow_runs ?? []) {
      const prev = latest.get(run.workflow_id);
      if (!prev || run.run_number > prev.run_number) latest.set(run.workflow_id, run);
    }
    return [...latest.values()].some((r) => r.conclusion !== null && FAILED.has(r.conclusion));
  } catch (e) {
    if (e instanceof GithubHttpError && (e.status === 403 || e.status === 404)) return false;
    throw e;
  }
}

/** Fetch everything mapGithub needs. Throws SourceError. */
export async function fetchGithub(token: string, now: Date, fetchImpl: typeof fetch = fetch): Promise<GhSnapshot> {
  const get = client(token, fetchImpl, AbortSignal.timeout(TIMEOUT_MS));
  const me = await get<{ login?: string }>("/user");
  if (!me.login) throw new SourceError("GitHub did not say who this token belongs to");
  const login = me.login;
  const since = new Date(now.getTime() - RECENT_MS).toISOString().replace(/\.\d{3}Z$/, "Z");

  const [assigned, reviewRequested, mine, closedAssigned, mergedMine] = await Promise.all([
    search(get, `is:open is:issue archived:false assignee:${login}`),
    search(get, `is:open is:pr archived:false review-requested:${login}`),
    search(get, `is:open is:pr archived:false author:${login}`, MAX_CI_PRS),
    search(get, `is:closed is:issue reason:completed assignee:${login} closed:>=${since}`),
    search(get, `is:pr is:merged author:${login} merged:>=${since}`),
  ]);
  const checked = mine.slice(0, MAX_CI_PRS);
  const failing = await Promise.all(checked.map((pr) => ciFailing(get, pr)));
  return { assigned, reviewRequested, failingCi: checked.filter((_, i) => failing[i]), closedAssigned, mergedMine };
}

export const githubAdapter: SourceAdapter = {
  async fetchItems(source, ctx) {
    return mapGithub(await fetchGithub(source.secret, ctx.now, ctx.fetchImpl), source.id, ctx.now);
  },
};
