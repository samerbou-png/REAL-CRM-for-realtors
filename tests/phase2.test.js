import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'real-crm-p2-'));

const { createLead, updateLead } = await import('../src/services/leads.js');
const { findGoneColdLeads, processGoneColdLeads } = await import('../src/services/coldLeads.js');
const { summarizeLead } = await import('../src/services/ollama.js');
const {
  createCampaign,
  addCampaignStep,
  enrollLead,
  processDueCampaignSteps,
} = await import('../src/services/campaigns.js');
const { approveDraft, markSent, getApproval } = await import('../src/services/approvals.js');

const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

test('gone-cold detection finds idle leads', () => {
  const lead = createLead({ first_name: 'Cold', last_name: 'Lead', stage: 'contacted' });
  updateLead(lead.id, { last_activity_at: daysAgo(10) });

  const cold = findGoneColdLeads({ coldDays: 7 });
  assert.equal(cold.length, 1);
  assert.equal(cold[0].lead.id, lead.id);
});

test('processGoneColdLeads queues draft or task', async () => {
  const lead = createLead({ first_name: 'Idle', last_name: 'Buyer' });
  updateLead(lead.id, { last_activity_at: daysAgo(12) });

  const results = await processGoneColdLeads();
  const ours = results.filter((result) => result.lead.id === lead.id);
  assert.equal(ours.length, 1);
  assert.ok(ours[0].activity.trigger === 'gone_cold');
});

test('summarizeLead returns fallback insight without Ollama', async () => {
  const lead = createLead({ first_name: 'Insight', last_name: 'Lead', stage: 'qualified' });
  const insight = await summarizeLead(lead.id);
  assert.ok(insight.headline);
  assert.ok(insight.next_action);
});

test('drip campaign creates per-step approval and advances after send', async () => {
  const lead = createLead({ first_name: 'Drip', last_name: 'Lead' });
  const campaign = createCampaign({ name: 'Test Nurture' });
  addCampaignStep(campaign.id, {
    step_order: 1,
    delay_days: 0,
    summary: 'Welcome',
    draft_template: 'Hi {{first_name}}, welcome!',
  });
  addCampaignStep(campaign.id, {
    step_order: 2,
    delay_days: 0,
    summary: 'Follow up',
    draft_template: 'Hi {{first_name}}, checking in.',
  });

  const enrollment = enrollLead(campaign.id, lead.id);
  assert.equal(enrollment.status, 'active');

  const results = await processDueCampaignSteps();
  assert.equal(results.length, 1);
  assert.equal(results[0].enrollment.status, 'pending_approval');

  const approvalId = results[0].approval.id;
  approveDraft(approvalId);
  markSent(approvalId);

  const approval = getApproval(approvalId);
  assert.equal(approval.status, 'sent');
});

test.after(() => {
  rmSync(process.env.DATA_DIR, { recursive: true, force: true });
});
