import { createHash } from "node:crypto";
import { deadlineCalendar, type CalendarDeadline } from "@/lib/calendar/ical";
import { CALENDAR_TOKEN_RE } from "@/lib/calendar/links";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const privateHeaders = {
  "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow, noarchive",
};

/** Token-authenticated read through a narrow SQL function. No admin client or website login. */
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token: file } = await context.params;
  const token = file.endsWith(".ics") ? file.slice(0, -4) : "";
  if (!CALENDAR_TOKEN_RE.test(token)) return new Response("Calendar subscription not found", { status: 404, headers: privateHeaders });
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("calendar_subscription_tasks", {
      p_token_hash: createHash("sha256").update(token).digest("hex"),
    });
    if (error) return new Response("Calendar temporarily unavailable", { status: 503, headers: privateHeaders });
    if (!data) return new Response("Calendar subscription not found", { status: 404, headers: privateHeaders });
    const tasks = (data as { tasks: CalendarDeadline[] }).tasks;
    return new Response(deadlineCalendar(tasks), {
      headers: { ...privateHeaders, "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="boilerplate-deadlines.ics"' },
    });
  } catch {
    return new Response("Calendar temporarily unavailable", { status: 503, headers: privateHeaders });
  }
}
