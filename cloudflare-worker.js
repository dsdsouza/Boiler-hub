import handler from "./.open-next/worker.js";

const worker = {
  fetch: handler.fetch,

  async scheduled(_event, env, ctx) {
    // Leave background sync inactive until production secrets are configured.
    if (!env.CRON_SECRET) {
      console.log("[cron/resync] Skipped: CRON_SECRET is not configured");
      return;
    }

    const response = await handler.fetch(
      new Request("https://boilerplate.internal/api/cron/resync", {
        headers: { authorization: `Bearer ${env.CRON_SECRET}` },
      }),
      env,
      ctx,
    );
    if (!response.ok) {
      throw new Error(`Background resync failed with HTTP ${response.status}`);
    }
  },
};

export default worker;
