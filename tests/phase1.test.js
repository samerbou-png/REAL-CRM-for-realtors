import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'real-crm-test-'));

const { createLead, listLeads } = await import('../src/services/leads.js');
const { logActivity } = await import('../src/services/activities.js');
const { queueDraft, approveDraft, markSent, listPendingApprovals } = await import('../src/services/approvals.js');
const { getLeadFeed, scoreLead } = await import('../src/services/leadFeed.js');

test('lead feed ranks higher intent leads first', () => {
  const hot = createLead({ first_name: 'Hot', last_name: 'Lead', stage: 'qualified' });
  const cold = createLead({ first_name: 'Cold', last_name: 'Lead', stage: 'new' });

  logActivity({
    lead_id: hot.id,
    type: 'site_event',
    trigger: 'form_submit',
    summary: 'Submitted contact form',
  });

  const feed = getLeadFeed({ limit: 10 });
  assert.equal(feed[0].id, hot.id);
  assert.ok(feed[0].priority_score > scoreLead(cold).priority_score);
  assert.ok(feed[0].reasons.length > 0);
});

test('approval queue requires explicit approve before send', () => {
  const lead = createLead({ first_name: 'Queue', last_name: 'Lead' });
  const draft = queueDraft({
    lead_id: lead.id,
    trigger: 'saved_listing',
    summary: 'Follow up on saved listing',
    original_draft: 'Hi there, still interested?',
    confidence: 'high',
  });

  assert.equal(listPendingApprovals().length, 1);

  assert.throws(() => markSent(draft.id), /must be approved/);

  approveDraft(draft.id, draft.original_draft);
  const sent = markSent(draft.id);
  assert.equal(sent.status, 'sent');
  assert.equal(listPendingApprovals().length, 0);
});

test.after(() => {
  rmSync(process.env.DATA_DIR, { recursive: true, force: true });
});
