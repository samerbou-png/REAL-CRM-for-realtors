import { ensureDataDir } from './config.js';
import { createLead, updateLead } from './services/leads.js';
import { logActivity } from './services/activities.js';
import { queueDraft } from './services/approvals.js';
import {
  createCampaign,
  addCampaignStep,
  enrollLead,
} from './services/campaigns.js';

const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

export function seedDemoData() {
  ensureDataDir();

  const maria = createLead({
    first_name: 'Maria',
    last_name: 'Chen',
    email: 'maria.chen@example.com',
    phone: '555-0101',
    stage: 'qualified',
    source: 'website',
    notes: 'Pre-approved buyer looking in Riverside.',
    last_touch_at: daysAgo(4),
  });

  const james = createLead({
    first_name: 'James',
    last_name: 'Patel',
    email: 'james.patel@example.com',
    phone: '555-0102',
    stage: 'showing',
    source: 'facebook',
    notes: 'Wants 3 bed near schools.',
    last_touch_at: daysAgo(1),
  });

  const avery = createLead({
    first_name: 'Avery',
    last_name: 'Lopez',
    email: 'avery.lopez@example.com',
    phone: '555-0103',
    stage: 'new',
    source: 'referral',
    notes: 'Investor, cash buyer.',
    last_touch_at: '',
  });

  const dana = createLead({
    first_name: 'Dana',
    last_name: 'Kim',
    email: 'dana.kim@example.com',
    phone: '555-0104',
    stage: 'contacted',
    source: 'website',
    notes: 'Browsed condos last month, then went quiet.',
    last_touch_at: daysAgo(10),
  });

  updateLead(dana.id, { last_activity_at: daysAgo(9), last_touch_at: daysAgo(10) });

  logActivity({
    lead_id: maria.id,
    type: 'site_event',
    trigger: 'saved_listing',
    summary: 'Saved 142 Oak Street',
    metadata: { listing_id: 'MLS-142' },
  });

  logActivity({
    lead_id: maria.id,
    type: 'site_event',
    trigger: 'repeat_view',
    summary: 'Viewed 142 Oak Street again',
    metadata: { listing_id: 'MLS-142', views: 3 },
  });

  logActivity({
    lead_id: james.id,
    type: 'site_event',
    trigger: 'form_submit',
    summary: 'Requested showing for 88 Maple Ave',
    metadata: { listing_id: 'MLS-88' },
  });

  logActivity({
    lead_id: james.id,
    type: 'call',
    trigger: 'manual',
    summary: 'Confirmed Saturday showing',
  });

  logActivity({
    lead_id: avery.id,
    type: 'site_event',
    trigger: 'returned_after_idle',
    summary: 'Returned after 10 days idle',
    metadata: { idle_days: 10 },
  });

  updateLead(dana.id, { last_activity_at: daysAgo(9), last_touch_at: daysAgo(10) });

  queueDraft({
    lead_id: maria.id,
    channel: 'text',
    trigger: 'repeat_view',
    summary: 'High intent on 142 Oak Street',
    original_draft:
      'Hi Maria, I noticed you keep coming back to 142 Oak Street. Want me to set up a private showing this week?',
    confidence: 'high',
    reason: 'intent: repeat view + saved listing',
  });

  queueDraft({
    lead_id: james.id,
    channel: 'text',
    trigger: 'form_submit',
    summary: 'Showing request follow-up',
    original_draft:
      'Hi James, thanks for requesting a showing at 88 Maple Ave. Does Saturday at 2pm still work?',
    confidence: 'medium',
    reason: 'intent: form submit + showing stage',
  });

  const nurture = createCampaign({ name: 'New Lead Welcome' });
  addCampaignStep(nurture.id, {
    step_order: 1,
    channel: 'text',
    delay_days: 0,
    summary: 'Welcome message for new leads',
    draft_template: 'Hi {{first_name}}, thanks for reaching out. What neighborhoods are you considering?',
  });
  addCampaignStep(nurture.id, {
    step_order: 2,
    channel: 'text',
    delay_days: 3,
    summary: 'Day 3 check-in',
    draft_template: 'Hi {{first_name}}, just checking in — still exploring homes or ready to tour a few options?',
  });
  enrollLead(nurture.id, avery.id);

  return { maria, james, avery, dana, nurture };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const leads = seedDemoData();
  console.log(
    'Seeded demo data:',
    [leads.maria, leads.james, leads.avery, leads.dana]
      .map((lead) => `${lead.first_name} ${lead.last_name}`)
      .join(', '),
  );
  console.log('Campaign:', leads.nurture.name);
}
