import type { LoadItem, Size } from "@/lib/types";

// Shapes for external task sources (ICS feeds, GitHub). Defined here, not in lib/types.ts (frozen).

export type SourceKind = "ics" | "github";
export type SourceStatus = "ok" | "error";

/** A `sources` row as clients may see it. Never includes the secret. */
export interface SourceRow {
  id: string;
  kind: SourceKind;
  label: string;
  coursework: boolean;
  last_synced_at: string | null;
  status: SourceStatus;
  error: string | null;
  created_at: string;
}

/** Columns clients may select (column grants in 0002_sources.sql). */
export const SOURCE_COLUMNS = "id, kind, label, coursework, last_synced_at, status, error, created_at";

/** What an adapter gets: the row plus the decrypted secret (ICS URL or GitHub token). Server only. */
export interface AdapterSource {
  id: string;
  kind: SourceKind;
  label: string;
  coursework: boolean;
  secret: string;
}

/** A LoadItem from a source, plus what the owner needs to act on it. Titles are live, never stored. */
export interface SourceItem extends LoadItem {
  source: SourceKind;
  sourceId: string;
  /** sha256 hex of the external id; the source_item_state key. */
  itemKey: string;
  /** Link to the item (GitHub). */
  url?: string;
  /** Class or repo the item belongs to (ICS: from the feed, else the source label; GitHub: "owner/repo"). */
  course?: string;
}

export interface FetchContext {
  now: Date;
  /** IANA zone for all-day deadlines; the user's calendar zone. */
  timeZone: Promise<string> | string;
  fetchImpl?: typeof fetch;
}

export interface SourceAdapter {
  fetchItems(source: AdapterSource, ctx: FetchContext): Promise<SourceItem[]>;
}

export interface ItemStateRow {
  source_id: string;
  item_key: string;
  done_at: string | null;
  size_override: Size | null;
}

/** A failure whose message is safe to show the user and store in `sources.error`. */
export class SourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceError";
  }
}

/** `${sourceId}:${itemKey}`: the LoadItem / task id of a source item. */
export const sourceItemId = (sourceId: string, itemKey: string) => `${sourceId}:${itemKey}`;
