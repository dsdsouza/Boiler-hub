#!/usr/bin/env node
// Run with the repository owner's gh login. Never reads or prints auth tokens.
import { execFileSync } from 'node:child_process';

const repo = 'dsdsouza/Boiler-hub';
const api = (path, args = [], input) => JSON.parse(execFileSync('gh', ['api', path, ...args], {
  encoding: 'utf8', ...(input ? { input: JSON.stringify(input) } : {}),
}));
const repository = api(`repos/${repo}`);
if (!repository.permissions?.admin) {
  console.error(`Repository-admin permission is required to protect ${repo}/main. Sign in as the repository owner and rerun pnpm qa:protect-main.`);
  process.exit(1);
}
const runs = api(`repos/${repo}/commits/staging/check-runs?per_page=100`).check_runs;
const gate = runs.find((run) => run.name === 'QA gate' && run.app?.slug === 'github-actions' && run.conclusion === 'success');
if (!gate) throw new Error('Staging must have a successful GitHub Actions QA gate before protection can be configured.');
const protection = {
  required_status_checks: { strict: true, checks: [{ context: 'QA gate', app_id: gate.app.id }] },
  enforce_admins: true,
  required_pull_request_reviews: { required_approving_review_count: 0 },
  restrictions: null,
  allow_force_pushes: false,
  allow_deletions: false,
  required_conversation_resolution: true,
};
api(`repos/${repo}/branches/main/protection`, ['--method', 'PUT', '--input', '-'], protection);
const verified = api(`repos/${repo}/branches/main/protection`);
if (!verified.enforce_admins?.enabled || !verified.required_status_checks?.strict ||
    !verified.required_status_checks?.checks?.some((check) => check.context === 'QA gate' && check.app_id === gate.app.id)) {
  throw new Error('GitHub did not return the expected required-check protection. Inspect main branch settings.');
}
console.log('Main requires an up-to-date PR and the GitHub Actions QA gate, including for administrators. Force pushes and deletion are disabled.');
