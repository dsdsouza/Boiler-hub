import { test, expect, type Page } from '@playwright/test';
import { world } from './world';

const step = (name: string, body: () => Promise<unknown>) => test.step(name, body, { timeout: 35_000 });
const plan = (steps: string[]) => ({ annotation: { type: 'workflow-steps', description: JSON.stringify([...steps, 'Restore test data']) } });
const open = (page: Page, view = 'boiler') => page.goto(`/qa-workflows?view=${view}`);
// Reopen the page in the same browser session. This checks a genuinely fresh
// document and keeps external calendar hand-offs out of later UI interactions.
const reopen = async (page: Page) => {
  const fresh = await page.context().newPage();
  await fresh.goto(page.url());
  await page.close();
  return fresh;
};
const noteField = (page: Page) => page.getByRole('textbox', { name: 'Status note (shown to your teams)', exact: true });
const taskButton = (page: Page, title: string, done = false) => page.getByRole('button', { name: `${done ? 'Mark not done' : 'Complete'}: ${title}`, exact: true });
async function showCompleted(page: Page, title: string) {
  const hidden = page.getByRole('button', { name: `Mark not done: ${title}`, exact: true, includeHidden: true });
  await expect(hidden).toHaveCount(1);
  const details = page.locator('details').filter({ has: hidden });
  if (await details.getAttribute('open') === null) await details.locator('summary').click();
  await expect(taskButton(page, title, true)).toBeVisible();
}

test('Onboarding through a completed and restored task', plan([
  'Read the first synced gauge', 'Save an onboarding status note', 'Open the personal workload',
  'Create a dated task', 'Resize and persist the task', 'Complete the task', 'Verify completion after reopening', 'Reopen the task',
]), async ({ page, context }) => {
  const service = world(); await service.connect(context);
  try {
    await step('Read the first synced gauge', async () => { await open(page, 'onboarding'); await expect(page.getByText('Connected.', { exact: true })).toBeVisible(); });
    await step('Save an onboarding status note', async () => { await noteField(page).fill('Ready for the workflow'); await noteField(page).press('Enter'); await expect(page.getByText('Saved', { exact: true })).toBeVisible(); });
    await step('Open the personal workload', async () => { await page.getByRole('navigation', { name: 'Workflow pages' }).getByRole('link', { name: 'boiler', exact: true }).click(); await expect(noteField(page)).toHaveValue('Ready for the workflow'); });
    await step('Create a dated task', async () => { await page.getByRole('textbox', { name: 'New task', exact: true }).fill('Workflow deliverable'); await page.getByRole('button', { name: 'Add task', exact: true }).click(); await expect(taskButton(page, 'Workflow deliverable')).toBeEnabled(); });
    await step('Resize and persist the task', async () => { await page.getByRole('combobox', { name: 'Size: Workflow deliverable', exact: true }).selectOption('L'); await expect.poll(() => service.users[0].tasks[0].size).toBe('L'); page = await reopen(page); await expect(page.getByRole('combobox', { name: 'Size: Workflow deliverable', exact: true })).toHaveValue('L'); });
    await step('Complete the task', async () => { await taskButton(page, 'Workflow deliverable').click(); await showCompleted(page, 'Workflow deliverable'); });
    await step('Verify completion after reopening', async () => { page = await reopen(page); await showCompleted(page, 'Workflow deliverable'); });
    await step('Reopen the task', async () => { await taskButton(page, 'Workflow deliverable', true).click(); await expect(taskButton(page, 'Workflow deliverable')).toBeVisible(); });
  } finally { await step('Restore test data', async () => { service.reset(); expect(service.users[0].tasks).toEqual([]); }); }
});

for (const type of ['class', 'work'] as const) test(`Two-account ${type} team to completed assignment`, plan([
  'Create a team as its lead', 'Read and share the invite code', 'Recover from an invalid invite', 'Join the team as a second person',
  'Confirm the new member starts hidden', 'Share the member boiler', 'See the member in the lead engine room',
  'Preview a dated assignment', 'Post the assignment once', 'Find the assignment in the member workload',
  'Complete the assigned task', 'Verify completion survives reopening', 'Hide the member boiler again', 'Confirm the lead cannot see the hidden member',
]), async ({ page, context, browser }) => {
  const service = world(); await service.connect(context);
  const memberContext = await browser.newContext({ ...test.info().project.use, baseURL: test.info().project.use.baseURL });
  await service.connect(memberContext, 'member'); let member = await memberContext.newPage();
  const title = `Workflow ${type} delivery`, teamName = `Workflow ${type} team`;
  try {
    await step('Create a team as its lead', async () => { await open(page, 'teams'); await page.getByRole('textbox', { name: 'Name', exact: true }).fill(teamName); if (type === 'class') await page.getByRole('button', { name: 'Class', exact: true }).click(); await page.getByRole('button', { name: 'Create team', exact: true }).click(); await expect(page.getByRole('status').filter({ hasText: `Created ${teamName}` })).toBeVisible(); });
    await step('Read and share the invite code', async () => { await expect(page.getByRole('status').filter({ hasText: 'WF1234' })).toBeVisible(); expect(service.teams).toHaveLength(1); });
    await step('Recover from an invalid invite', async () => { await open(member, 'teams'); await member.getByRole('textbox', { name: 'Invite code', exact: true }).fill('BAD000'); await member.getByRole('button', { name: 'Join team', exact: true }).click(); await expect(member.getByRole('alert').filter({ hasText: 'No team found' })).toBeVisible(); await expect(member.getByRole('textbox', { name: 'Invite code', exact: true })).toHaveValue('BAD000'); });
    await step('Join the team as a second person', async () => { await member.getByRole('textbox', { name: 'Invite code', exact: true }).fill('wf1234'); await member.getByRole('button', { name: 'Join team', exact: true }).click(); await expect(member.getByRole('status').filter({ hasText: 'Joined.' })).toBeVisible(); member = await reopen(member); await member.getByRole('link', { name: teamName, exact: true }).click(); await expect(member.getByRole('heading', { level: 1, name: teamName })).toBeVisible(); });
    await step('Confirm the new member starts hidden', async () => { await member.getByText('Your visibility on this team', { exact: true }).click(); await expect(member.getByRole('radio', { name: /^Hidden/ })).toBeChecked(); await expect(member.getByRole('heading', { name: 'New assignment', exact: true })).toHaveCount(0); });
    await step('Share the member boiler', async () => { const everyone = member.getByRole('radio', { name: /^Everyone/ }); await everyone.check(); await expect(everyone).toBeEnabled(); await expect(everyone).toBeChecked(); });
    await step('See the member in the lead engine room', async () => { page = await reopen(page); await page.getByRole('link', { name: teamName, exact: true }).click(); await expect(page.getByRole('heading', { level: 2, name: 'Workflow member', exact: true })).toBeVisible(); });
    await step('Preview a dated assignment', async () => { await page.getByRole('textbox', { name: 'Title', exact: true }).fill(title); await page.getByRole('button', { name: 'Tomorrow', exact: true }).click(); await expect(page.getByRole('button', { name: /^Post to 1 / })).toBeEnabled(); });
    await step('Post the assignment once', async () => { await page.getByRole('button', { name: /^Post to 1 / }).click(); await expect(page.getByText('Posted', { exact: true })).toBeVisible(); expect(service.users[1].tasks.filter(t => t.title === title)).toHaveLength(1); });
    await step('Find the assignment in the member workload', async () => { await member.getByRole('navigation', { name: 'Workflow pages' }).getByRole('link', { name: 'boiler', exact: true }).click(); await expect(taskButton(member, title)).toBeVisible(); });
    await step('Complete the assigned task', async () => { await taskButton(member, title).click(); await showCompleted(member, title); });
    await step('Verify completion survives reopening', async () => { member = await reopen(member); await showCompleted(member, title); });
    await step('Hide the member boiler again', async () => { await open(member, 'teams'); const hidden = member.getByRole('radio', { name: /^Hidden/ }); await hidden.check(); await expect(hidden).toBeEnabled(); await expect(hidden).toBeChecked(); });
    await step('Confirm the lead cannot see the hidden member', async () => { page = await reopen(page); await expect(page.getByRole('heading', { level: 2, name: 'Workflow member', exact: true })).toHaveCount(0); });
  } finally { await step('Restore test data', async () => { await memberContext.close(); service.reset(); expect(service.teams).toEqual([]); expect(service.users[1].tasks).toEqual([]); }); }
});

test('A failed save can recover and finish the workload', plan([
  'Open the personal workload', 'Keep a rejected task draft', 'Retry the task successfully', 'Keep a rejected status note',
  'Retry the status successfully', 'Complete the recovered task', 'Verify the recovered data after reopening',
]), async ({ page, context }) => {
  const service = world(); await service.connect(context);
  service.failOnce('POST /api/tasks'); service.failOnce('PATCH /api/me/status');
  try {
    await step('Open the personal workload', async () => { await open(page); await expect(page.getByRole('textbox', { name: 'New task', exact: true })).toBeVisible(); });
    await step('Keep a rejected task draft', async () => { await page.getByRole('textbox', { name: 'New task', exact: true }).fill('Recovery task'); await page.getByRole('button', { name: 'Add task', exact: true }).click(); await expect(page.getByRole('alert').filter({ hasText: 'temporarily unavailable' })).toBeVisible(); await expect(page.getByRole('textbox', { name: 'New task', exact: true })).toHaveValue('Recovery task'); });
    await step('Retry the task successfully', async () => { await page.getByRole('button', { name: 'Add task', exact: true }).click(); await expect(taskButton(page, 'Recovery task')).toBeEnabled(); });
    await step('Keep a rejected status note', async () => { await noteField(page).fill('Recovery note'); await noteField(page).press('Enter'); await expect(page.getByRole('alert').filter({ hasText: 'temporarily unavailable' })).toBeVisible(); await expect(noteField(page)).toHaveValue('Recovery note'); await expect(page.getByText('Saved', { exact: true })).toHaveCount(0); });
    await step('Retry the status successfully', async () => { await noteField(page).press('Enter'); await expect(page.getByText('Saved', { exact: true })).toBeVisible(); });
    await step('Complete the recovered task', async () => { await taskButton(page, 'Recovery task').click(); await showCompleted(page, 'Recovery task'); });
    await step('Verify the recovered data after reopening', async () => { page = await reopen(page); await expect(noteField(page)).toHaveValue('Recovery note'); await showCompleted(page, 'Recovery task'); });
  } finally { await step('Restore test data', async () => { service.reset(); }); }
});

test('Calendar feed connection through removal with recovery', plan([
  'Open source connections', 'Enter a fictional calendar feed', 'Recover from a connection failure', 'Verify the connected source',
  'Test the connected feed', 'Cancel removing the source', 'Confirm removing the source', 'Verify the source stays removed after reopening',
]), async ({ page, context }) => {
  const service = world(); await service.connect(context); service.failOnce('POST /api/sources');
  try {
    await step('Open source connections', async () => { await open(page, 'sources'); await page.getByRole('tab', { name: 'Calendar feed', exact: true }).click(); });
    await step('Enter a fictional calendar feed', async () => { await page.getByRole('textbox', { name: 'Calendar feed link (.ics or webcal://)', exact: true }).fill('https://calendar.example.test/feed.ics'); await page.getByRole('textbox', { name: 'Name (optional)', exact: true }).fill('Workflow feed'); });
    await step('Recover from a connection failure', async () => { await page.getByRole('button', { name: 'Add feed', exact: true }).click(); await expect(page.getByText('Workflow service temporarily unavailable. Try again.', { exact: true })).toBeVisible(); await expect(page.getByRole('textbox', { name: 'Calendar feed link (.ics or webcal://)', exact: true })).toHaveValue('https://calendar.example.test/feed.ics'); await page.getByRole('button', { name: 'Add feed', exact: true }).click(); });
    await step('Verify the connected source', async () => { await expect(page.getByRole('button', { name: 'Test Workflow feed', exact: true })).toBeVisible(); page = await reopen(page); await expect(page.getByRole('button', { name: 'Test Workflow feed', exact: true })).toBeVisible(); });
    await step('Test the connected feed', async () => { await page.getByRole('button', { name: 'Test Workflow feed', exact: true }).click(); await expect(page.getByText('Found 1 deadline and 0 events in this feed.', { exact: true })).toBeVisible(); });
    await step('Cancel removing the source', async () => { await page.getByRole('button', { name: 'Remove Workflow feed', exact: true }).click(); await page.getByRole('button', { name: 'Cancel', exact: true }).click(); expect(service.users[0].sources).toHaveLength(1); });
    await step('Confirm removing the source', async () => { await page.getByRole('button', { name: 'Remove Workflow feed', exact: true }).click(); await page.getByRole('button', { name: 'Confirm removal', exact: true }).click(); await expect(page.getByRole('button', { name: 'Test Workflow feed', exact: true })).toHaveCount(0); });
    await step('Verify the source stays removed after reopening', async () => { page = await reopen(page); await expect(page.getByText('Nothing connected yet.', { exact: false })).toBeVisible(); expect(service.users[0].sources).toEqual([]); });
  } finally { await step('Restore test data', async () => { service.reset(); }); }
});

test('Private calendar subscription from consent through revocation', plan([
  'Open subscription settings', 'Cancel the first consent request', 'Recover from subscription creation failure', 'Verify the private link survives reopening',
  'Cancel disabling the subscription', 'Confirm disabling the subscription', 'Verify the private link stays revoked after reopening',
]), async ({ page, context }) => {
  const service = world(); await service.connect(context); service.failOnce('POST /api/calendar/subscription');
  try {
    await step('Open subscription settings', async () => { await open(page, 'sources'); await expect(page.getByRole('button', { name: 'Subscribe in Apple Calendar', exact: true })).toBeEnabled(); });
    await step('Cancel the first consent request', async () => { await page.getByRole('button', { name: 'Subscribe in Apple Calendar', exact: true }).click(); await page.getByRole('group', { name: 'Subscribe to your deadlines?', exact: true }).getByRole('button', { name: 'Cancel', exact: true }).click(); expect(service.users[0].feedPath).toBeNull(); });
    await step('Recover from subscription creation failure', async () => { await page.getByRole('button', { name: 'Subscribe in Apple Calendar', exact: true }).click(); await page.getByRole('button', { name: 'Confirm subscription', exact: true }).click(); await expect(page.getByRole('alert').filter({ hasText: 'temporarily unavailable' })).toBeVisible(); await page.getByRole('button', { name: 'Confirm subscription', exact: true }).click(); await expect(page.getByRole('textbox', { name: 'Private calendar URL', exact: true })).toBeVisible(); });
    await step('Verify the private link survives reopening', async () => { page = await reopen(page); await expect(page.getByRole('textbox', { name: 'Private calendar URL', exact: true })).toHaveValue(/\/api\/calendar\/feed\//); });
    await step('Cancel disabling the subscription', async () => { await page.getByRole('button', { name: 'Disable subscription', exact: true }).click(); await page.getByRole('group', { name: 'Disable this subscription?', exact: true }).getByRole('button', { name: 'Cancel', exact: true }).click(); expect(service.users[0].feedPath).not.toBeNull(); });
    await step('Confirm disabling the subscription', async () => { await page.getByRole('button', { name: 'Disable subscription', exact: true }).click(); await page.getByRole('button', { name: 'Confirm disabling', exact: true }).click(); await expect(page.getByRole('textbox', { name: 'Private calendar URL', exact: true })).toHaveCount(0); });
    await step('Verify the private link stays revoked after reopening', async () => { page = await reopen(page); await expect(page.getByRole('button', { name: 'Subscribe in Apple Calendar', exact: true })).toBeEnabled(); expect(service.users[0].feedPath).toBeNull(); });
  } finally { await step('Restore test data', async () => { service.reset(); }); }
});

test('Pip help through a failed request and a completed conversation', plan([
  'Open Pip from the workload', 'Keep a question after a failed reply', 'Retry and receive a reply',
  'Ask a follow-up question', 'Close the conversation', 'Reopen without the previous conversation',
]), async ({ page, context }) => {
  const service = world(); await service.connect(context); service.failOnce('POST /api/pip/chat');
  try {
    await step('Open Pip from the workload', async () => { await open(page); await page.getByRole('button', { name: 'Ask Pip', exact: true }).click(); await expect(page.getByRole('textbox', { name: 'Message Pip', exact: true })).toBeFocused(); });
    await step('Keep a question after a failed reply', async () => { await page.getByRole('textbox', { name: 'Message Pip', exact: true }).fill('What should I work on?'); await page.getByRole('button', { name: 'Send message', exact: true }).click(); await expect(page.getByRole('alert').filter({ hasText: 'temporarily unavailable' })).toBeVisible(); await expect(page.getByRole('textbox', { name: 'Message Pip', exact: true })).toHaveValue('What should I work on?'); });
    await step('Retry and receive a reply', async () => { await page.getByRole('button', { name: 'Send message', exact: true }).click(); await expect(page.getByRole('log', { name: 'Conversation with Pip', exact: true })).toContainText('Workflow: start with the dated deliverable.'); });
    await step('Ask a follow-up question', async () => { await page.getByRole('textbox', { name: 'Message Pip', exact: true }).fill('And after that?'); await page.getByRole('textbox', { name: 'Message Pip', exact: true }).press('Enter'); await expect(page.getByRole('log', { name: 'Conversation with Pip', exact: true }).getByText('Workflow: start with the dated deliverable.', { exact: false })).toHaveCount(2); });
    await step('Close the conversation', async () => { await page.getByRole('button', { name: 'Close chat', exact: true }).click(); await expect(page.getByRole('textbox', { name: 'Message Pip', exact: true })).toHaveCount(0); });
    await step('Reopen without the previous conversation', async () => { await page.getByRole('button', { name: 'Ask Pip', exact: true }).click(); await expect(page.getByRole('log', { name: 'Conversation with Pip', exact: true })).not.toContainText('And after that?'); await expect(page.getByRole('textbox', { name: 'Message Pip', exact: true })).toHaveValue(''); });
  } finally { await step('Restore test data', async () => { service.reset(); }); }
});
