# Coursework imports

Boiler Hub reads calendar subscription URLs. The import changes use the fictional feeds saved in the **Investigate Webly schedule scraping** chat, including its Coursicle comparisons. They do not require a school login or a browser extension.

## Supported feed formats

Brightspace, Canvas, Moodle and Blackboard links are recognized by their host or calendar path, including school-owned domains. Their all-day entries default to coursework deadlines. Users can still turn that option off. Ordinary timed calendar events remain events.

Assignments can be identified by their title or an explicit LMS assignment link in `URL` or `DESCRIPTION`. Essays, readings, homework, discussions, papers and problem sets no longer need the word “due” to become tasks. Timed deadlines use the event's end time; all-day deadlines use 23:59 in the feed's time zone, or the user's calendar time zone when absent.

The owner sees available assignment links and course labels. Canvas uses the bracketed course label, Brightspace uses `LOCATION` alongside its course link, and Moodle uses `CATEGORIES`. Blackboard items still import when no reliable course label is available. These fields are read from the feed; no class meeting times, credits or course names are generated. Links with executable schemes, embedded credentials or feed-token parameters are excluded.

## Refresh and identity

My Boiler's Refresh action fetches connected sources again. Routine reads may reuse a five-minute ICS cache on the same server instance. That cache is not a background polling schedule, and the school may independently cache its feed.

Items are matched by the feed's `UID`, with the recurrence identity added for repeat occurrences. A changed title or deadline updates the same task, preserving the owner's completion and size overrides. A moved recurring occurrence retains its original `RECURRENCE-ID`. Removed or cancelled entries disappear on the next successful fresh read. A failed source is reported as an error; it is not proof that assignments were removed.

No imported titles, descriptions, course labels or dates are stored. Existing source credentials remain encrypted, and owner state is stored against hashed item IDs. The database schema and `lib/types.ts` are unchanged by this work.

## Evidence and limits

Eight fictional before/after feeds from the investigation are checked into `lib/sources/__fixtures__/lms`. Tests cover all four initial imports, renames, deadline moves, additions, removals, completion preservation, metadata and links, and a complete feed → sync → owner view-model refresh. They also verify that the feed token and assignment contents do not enter snapshot/status writes.

The import reads only what the feed supplies. Grades, school-side submission status, catalog data and syllabus extraction require separate integrations. Synthetic fixtures do not establish compatibility with every school or prove a live school's refresh interval.

Official setup references: [Brightspace](https://community.d2l.com/brightspace/kb/articles/18042-manage-course-events-with-the-calendar-tool), [Canvas](https://community.instructure.com/en/kb/articles/662804-how-do-i-view-the-calendar-ical-feed-to-subscribe-to-an-external-calendar), [Moodle](https://docs.moodle.org/500/en/Using_Calendar), [Blackboard](https://help.anthology.com/blackboard/student/en/getting-started/calendar.html).
