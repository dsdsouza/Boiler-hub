export const DOMAINS = [
  "youtube.com",
  "instagram.com",
  "tiktok.com",
  "reddit.com",
  "x.com",
];
export function validateSession(session, now = Date.now()) {
  return Boolean(
    session &&
    typeof session.id === "string" &&
    session.id.length <= 80 &&
    session.id.length > 0 &&
    typeof session.taskId === "string" &&
    session.taskId.length > 0 &&
    session.taskId.length <= 300 &&
    typeof session.title === "string" &&
    session.title.length > 0 &&
    session.title.length <= 200 &&
    typeof session.goal === "string" &&
    session.goal.length <= 240 &&
    ["demo", "account"].includes(session.scope) &&
    typeof session.demo === "boolean" &&
    Number.isFinite(session.startAt) &&
    Number.isFinite(session.endAt) &&
    session.startAt > now - 7 * 86400000 &&
    session.startAt < now + 7 * 86400000 &&
    session.endAt > session.startAt &&
    session.endAt - session.startAt <= 45 * 60000 &&
    (session.outcome === undefined ||
      ["completed", "cancelled"].includes(session.outcome)),
  );
}
export function shouldBlock(session, now = Date.now()) {
  return (
    validateSession(session, now) &&
    !session.outcome &&
    now >= session.startAt &&
    now < session.endAt
  );
}
export function createRules(focusPage) {
  return DOMAINS.map((domain, index) => ({
    id: index + 1,
    priority: 1,
    action: {
      type: "redirect",
      redirect: { regexSubstitution: `${focusPage}#\\0` },
    },
    condition: {
      regexFilter: "^https?://.*",
      requestDomains: [domain],
      resourceTypes: ["main_frame"],
    },
  }));
}
export function isDistracting(url) {
  try {
    const parsed = new URL(url);
    return (
      ["http:", "https:"].includes(parsed.protocol) &&
      DOMAINS.some(
        (domain) =>
          parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`),
      )
    );
  } catch {
    return false;
  }
}
export function isApp(url) {
  try {
    const parsed = new URL(url);
    return (
      [
        "https://boilerhub.work",
        "https://www.boilerhub.work",
        "https://boilerplate.zhomander.workers.dev",
      ].includes(parsed.origin) ||
      (parsed.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(parsed.hostname) &&
        ["3000", "3001", "3002", "3100", "3101", "4174"].includes(parsed.port))
    );
  } catch {
    return false;
  }
}
