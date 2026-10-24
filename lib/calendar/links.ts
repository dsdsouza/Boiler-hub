export const CALENDAR_TOKEN_RE = /^[0-9a-f]{64}$/;

export interface SubscriptionLinks {
  https: string;
  webcal: string;
}

/** Use the current site origin, so preview/staging subscriptions never point at production. */
export function subscriptionLinks(feedPath: string, origin: string): SubscriptionLinks {
  if (!/^\/api\/calendar\/feed\/[0-9a-f]{64}\.ics$/.test(feedPath)) throw new Error("Invalid calendar subscription link");
  const url = new URL(feedPath, origin);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Invalid calendar origin");
  return { https: url.href, webcal: url.href.replace(/^https?:/, "webcal:") };
}
