// The URL contains a secret. Never log it or the response body, which could contain credentials.
try {
  const secret = process.env.TESTERARMY_GROUP_WEBHOOK_URL;
  if (!secret) throw new Error('Set the TESTERARMY_GROUP_WEBHOOK_URL repository secret from a TesterArmy group Webhook menu.');
  const webhook = new URL(secret);
  if (webhook.origin !== 'https://tester.army' || !/^\/api\/v1\/groups\/webhook\/[^/]+\/[^/]+$/.test(webhook.pathname)) throw new Error('Unexpected TesterArmy webhook URL');
  const target = new URL(process.env.QA_TARGET_URL || 'https://boilerhub.work');
  if (target.protocol !== 'https:' || target.username || target.password) throw new Error('Target must be a public HTTPS URL without credentials');
  const environment = process.env.QA_ENVIRONMENT || 'production';
  if (!['production', 'staging', 'preview'].includes(environment)) throw new Error('Unknown test environment');
  const response = await fetch(webhook, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetUrl: target.href, environment, commitSha: process.env.GITHUB_SHA }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`TesterArmy returned HTTP ${response.status}. Check the group, account quota and webhook setting in TesterArmy.`);
  console.log('TesterArmy accepted the group request. Check TesterArmy for actual run results; acceptance is not a test pass.');
} catch (error) {
  // Sanitize network failures: their messages can include the secret request URL.
  const message = error instanceof TypeError ? 'Could not reach TesterArmy; check the webhook setting.' : error.message;
  console.error(message);
  process.exitCode = 1;
}
