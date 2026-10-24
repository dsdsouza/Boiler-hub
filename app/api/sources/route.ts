import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { encrypt } from "@/lib/crypto";
import { parseFeedUrl } from "@/lib/sources/fetch";
import { defaultFeedLabel, isCourseworkUrl } from "@/lib/sources/hints";
import { ADAPTERS, errorMessage, fetchNewSource, toSummary } from "@/lib/sources/load";
import { SOURCE_COLUMNS, SourceError, type SourceKind, type SourceRow } from "@/lib/sources/types";
import { badRequest, readJson, requireUser, serverError, syncSelf } from "@/app/api/me/_lib/http";
import { MAX_SOURCES, itemCounts } from "./_lib";

// GET: the caller's sources (never the secret). RLS and column grants keep it owner-only.
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { data, error } = await auth.supabase.from("sources").select(SOURCE_COLUMNS).order("created_at").returns<SourceRow[]>();
  if (error) return serverError("GET /api/sources", error);
  return NextResponse.json({ sources: (data ?? []).map(toSummary) });
}

// POST { kind: 'ics', url, label?, coursework? } | { kind: 'github', token, label? }
// Validates by fetching before saving; a source that cannot be read is not saved (400 with the reason).
// Encrypts the URL or token, inserts, resyncs. Returns { source, itemCount, tasks, events, boiler }.
export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = await readJson(request);
  if (!body) return badRequest("Expected a JSON object");
  const kind = body.kind as SourceKind;
  if (kind !== "ics" && kind !== "github") return badRequest("kind must be ics or github");
  if (!ADAPTERS[kind]) return badRequest(`${kind} sources are not supported yet`);
  if (body.label !== undefined && (typeof body.label !== "string" || body.label.trim().length > 60)) {
    return badRequest("label must be at most 60 characters");
  }
  if (body.coursework !== undefined && typeof body.coursework !== "boolean") return badRequest("coursework must be true or false");

  let secret: string;
  let label: string;
  let coursework = false;
  try {
    if (kind === "ics") {
      if (typeof body.url !== "string" || body.url.length > 2048) return badRequest("url is required");
      secret = parseFeedUrl(body.url).href;
      label = (body.label as string | undefined)?.trim() || defaultFeedLabel(secret);
      coursework = (body.coursework as boolean | undefined) ?? isCourseworkUrl(secret);
    } else {
      if (typeof body.token !== "string" || !/^[A-Za-z0-9_]{20,255}$/.test(body.token.trim())) {
        return badRequest("Paste a GitHub personal access token");
      }
      secret = body.token.trim();
      label = (body.label as string | undefined)?.trim() || "GitHub";
    }
  } catch (e) {
    if (e instanceof SourceError) return badRequest(e.message);
    throw e;
  }

  const { count, error: countError } = await auth.supabase.from("sources").select("id", { count: "exact", head: true });
  if (countError) return serverError("POST /api/sources count", countError);
  if ((count ?? 0) >= MAX_SOURCES) return badRequest(`You can connect up to ${MAX_SOURCES} sources`);

  const id = randomUUID();
  let counts: ReturnType<typeof itemCounts>;
  try {
    counts = itemCounts(await fetchNewSource({ id, kind, label, coursework, secret }, new Date()));
  } catch (e) {
    if (!(e instanceof SourceError)) console.error("POST /api/sources validate failed", e);
    return badRequest(errorMessage(e));
  }

  // RLS + column grants: the user client can insert its own row and read back everything but the secret.
  const { data, error } = await auth.supabase
    .from("sources")
    .insert({ id, user_id: auth.user.id, kind, label, coursework, secret_encrypted: encrypt(secret) })
    .select(SOURCE_COLUMNS)
    .single<SourceRow>();
  if (error) return serverError("POST /api/sources", error);

  try {
    const boiler = await syncSelf(auth.user, { freshSources: true });
    const source = boiler.sources.find((s) => s.id === id) ?? toSummary(data);
    return NextResponse.json({ source, ...counts, boiler }, { status: 201 });
  } catch (e) {
    return serverError("POST /api/sources resync", e);
  }
}
