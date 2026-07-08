import { logActivity } from './activities.js';
import { suggestNextAction } from './ollama.js';

const TRIGGERS = {
  form_submit: 'Contact form submitted',
  saved_listing: 'Lead saved a listing',
  repeat_view: 'Lead viewed a listing again',
  returned_after_idle: 'Lead returned after being idle',
  replied: 'Lead replied to a message',
  gone_cold: 'Lead has gone cold',
};

export async function recordSiteEvent(leadId, trigger, summary = '') {
  if (!TRIGGERS[trigger]) {
    throw new Error(`Unknown trigger: ${trigger}`);
  }

  const activity = logActivity({
    lead_id: leadId,
    type: 'site_event',
    trigger,
    summary: summary || TRIGGERS[trigger],
    metadata: { trigger },
  });

  const result = await suggestNextAction(leadId, trigger);
  return { activity, ...result };
}

export function listSupportedTriggers() {
  return Object.entries(TRIGGERS).map(([id, label]) => ({ id, label }));
}
