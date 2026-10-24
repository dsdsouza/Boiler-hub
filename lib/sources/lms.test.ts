import { describe, expect, it } from "vitest";
import { defaultFeedLabel, isCourseworkUrl } from "./hints";
import { lmsProvider } from "./lms";

describe("LMS feed recognition on school-owned domains", () => {
  it.each([
    ["https://learn.school.edu/d2l/le/calendar/feed/user/feed.ics?token=example", "brightspace", "Brightspace"],
    ["webcal://learn.school.edu/feeds/calendars/user_example.ics", "canvas", "Canvas"],
    ["https://learn.school.edu/calendar/export_execute.php?userid=1&authtoken=example&preset_time=recentupcoming", "moodle", "Moodle"],
    ["https://learn.school.edu/webapps/calendar/calendarFeed/1/example.ics", "blackboard", "Blackboard"],
  ])("recognizes %s", (url, provider, label) => {
    expect(lmsProvider(url)).toBe(provider);
    expect(isCourseworkUrl(url)).toBe(true);
    expect(defaultFeedLabel(url)).toBe(label);
  });

  it.each(["not a link", "https://example.com/x.ics?provider=moodle", "https://outlook.office365.com/calendar/example.ics", "https://p123-caldav.icloud.com/published/2/example"])("does not guess from query strings or generic calendar links (%s)", (url) => {
    expect(lmsProvider(url)).toBeUndefined();
    expect(isCourseworkUrl(url)).toBe(false);
  });
});
