import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { encrypt } from "@/lib/crypto";
import { parseFeedUrl } from "@/lib/sources/fetch";
import { defaultFeedLabel, isCourseworkUrl } from "@/lib/sources/hints";
import { errorMessage, fetchNewSource, toSummary } from "@/lib/sources/load";
import { SOURCE_COLUMNS, SourceError, type SourceRow } from "@/lib/sources/types";
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

// POST { kind: 'ics', url, label?, coursework? }
// Validates by fetching before saving; a source that cannot be read is not saved (400 with the reason).
// Encrypts the URL, inserts, resyncs. Returns { source, itemCount, tasks, events, boiler }.
// The source is saved once inserted: if only the resync fails, it still returns 201, with
// `boiler: null` and a `warning`, so a retry does not add it twice.
export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = await readJson(request);
  if (!body) return badRequest("Expected a JSON object");
  if (body.kind !== "ics") return badRequest("Only calendar feeds are supported.");
  const kind = "ics";
  if (body.label !== undefined && (typeof body.label !== "string" || body.label.trim().length > 60)) {
    return badRequest("label must be at most 60 characters");
  }
  if (body.coursework !== undefined && typeof body.coursework !== "boolean") return badRequest("coursework must be true or false");

  let secret: string;
  let label: string;
  let coursework = false;
  try {
    if (typeof body.url !== "string" || body.url.length > 2048) return badRequest("url is required");
    secret = parseFeedUrl(body.url).href;
    label = (body.label as string | undefined)?.trim() || defaultFeedLabel(secret);
    coursework = (body.coursework as boolean | undefined) ?? isCourseworkUrl(secret);
  } catch (e) {
    if (e instanceof SourceError) return badRequest(e.message);
    throw e;
  }

  const { count, error: countError } = await auth.supabase.from("sources").select("id", { count: "exact", head: true }).eq("kind", "ics");
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
    console.error("POST /api/sources resync failed", e);
    return NextResponse.json(
      {
        source: toSummary(data),
        ...counts,
        boiler: null,
        warning: "Saved, but your boiler could not refresh right now. It will pick this source up on the next sync.",
      },
      { status: 201 },
    );
  }
}
