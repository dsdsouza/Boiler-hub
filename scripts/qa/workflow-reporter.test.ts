import { expect, it } from 'vitest';
import WorkflowReporter, { workflowSummary, renderWorkflows, problemKind, interruptWorkflows } from './workflow-reporter.mjs';

it('identifies the blocked goal and retains the last successful step and cleanup', () => {
  const report = workflowSummary([{ name: 'Team workflow', project: 'phone', status: 'stuck', steps: [
    { name: 'Create team', status: 'passed' }, { name: 'Post assignment', status: 'stuck' },
    { name: 'Complete assignment', status: 'blocked' }, { name: 'Restore test data', status: 'passed' },
  ] }], 'failed');
  expect(report).toMatchObject({ passed: 0, failed: 1, stepsPassed: 2, stuck: [{ step: 'Post assignment', lastCompleted: 'Create team', cleanup: 'passed' }] });
  expect(problemKind({ message: 'Step timeout of 35000ms exceeded' })).toBe('stuck');
  expect(problemKind({ message: 'Expected one task, received two' })).toBe('failed');
});
it('an interrupted run and unexecuted goals cannot be reported as complete', () => {
  const reporter = new WorkflowReporter(); reporter.save = () => {};
  const fake = { id: 'one', title: 'Workflow', annotations: [{ type: 'workflow-steps', description: '["Open","Save","Restore test data"]' }], parent: { project: () => ({ name: 'fixture' }) } };
  reporter.onBegin({}, { allTests: () => [fake] }); reporter.onTestBegin(fake);
  reporter.onStepBegin(fake, {}, { category: 'test.step', title: 'Open' });
  reporter.onStepEnd(fake, {}, { category: 'test.step', title: 'Open', duration: 1 });
  reporter.onEnd({ status: 'interrupted' });
  expect([...reporter.cases.values()][0]).toMatchObject({ status: 'interrupted', steps: [{ status: 'passed' }, { status: 'blocked' }, { status: 'blocked' }] });
});
it('a passed process with an incomplete plan is a failed workflow', () => {
  const reporter = new WorkflowReporter(); reporter.save = () => {};
  const fake = { id: 'one', title: 'Workflow', annotations: [{ type: 'workflow-steps', description: '["Open","Save"]' }], parent: { project: () => ({ name: 'fixture' }) } };
  reporter.onBegin({}, { allTests: () => [fake] });
  reporter.onTestEnd(fake, { status: 'passed', errors: [], attachments: [] });
  expect(reporter.cases.get('one').status).toBe('incomplete');
  expect(reporter.onEnd({ status: 'passed' })).toEqual({ status: 'failed' });
});
it('private error details never enter a public workflow report', () => {
  const reporter = new WorkflowReporter(); reporter.save = () => {};
  const fake = { id: 'one', title: 'Workflow', annotations: [{ type: 'workflow-steps', description: '["Save"]' }], parent: { project: () => ({ name: 'fixture' }) } };
  reporter.onBegin({}, { allTests: () => [fake] });
  reporter.onStepEnd(fake, {}, { category: 'test.step', title: 'Save', error: { message: 'Timeout: SECRET_TOKEN body' }, duration: 20 });
  reporter.onTestEnd(fake, { status: 'failed', errors: [{ message: 'SECRET_TOKEN' }], attachments: [{ name: 'private screenshot', path: '/private/SECRET_TOKEN.png' }] });
  const publicReport = workflowSummary([...reporter.cases.values()], 'failed');
  expect(JSON.stringify(publicReport)).not.toContain('SECRET_TOKEN');
  expect(renderWorkflows({ ...publicReport, coverage: '<script>bad</script>' })).not.toContain('<script>');
  expect(JSON.stringify(reporter.errors)).toContain('SECRET_TOKEN');
});
it('a killed browser process retains its active stopping point and blocks remaining goals', () => {
  const report = workflowSummary(interruptWorkflows([{ name: 'Workflow', project: 'fixture', status: 'running', steps: [
    { name: 'Open', status: 'passed' }, { name: 'Save', status: 'running' }, { name: 'Finish', status: 'queued' },
  ] }]), 'interrupted');
  expect(report).toMatchObject({ passed: 0, failed: 1, stuck: [{ step: 'Save', lastCompleted: 'Open', kind: 'interrupted' }] });
  expect(report.cases[0].steps[2].status).toBe('blocked');
});
