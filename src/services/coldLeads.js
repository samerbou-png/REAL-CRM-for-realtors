import { config } from '../config.js';
import { listLeads } from './leads.js';
import { listActivitiesForLead, logActivity } from './activities.js';
import { suggestNextAction } from './ollama.js';

function daysSince(isoDate) {
  if (!isoDate) {
    return Number.POSITIVE_INFINITY;
  }
  return (Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24);
}

function hasRecentColdSignal(leadId, withinHours = 24) {
  const activities = listActivitiesForLead(leadId);
  const cutoff = Date.now() - withinHours * 60 * 60 * 1000;
  return activities.some(
    (activity) => activity.trigger === 'gone_cold' && new Date(activity.created_at).getTime() >= cutoff,
  );
}

export function findGoneColdLeads({ coldDays = config.coldLeadDays } = {}) {
  return listLeads()
    .filter((lead) => !['closed', 'lost'].includes(lead.stage))
    .filter((lead) => {
      const idleDays = daysSince(lead.last_activity_at);
      return idleDays >= coldDays;
    })
    .filter((lead) => !hasRecentColdSignal(lead.id))
    .map((lead) => ({
      lead,
      idle_days: Math.floor(daysSince(lead.last_activity_at)),
    }));
}

export async function processGoneColdLeads() {
  const coldLeads = findGoneColdLeads();
  const results = [];

  for (const { lead, idle_days } of coldLeads) {
    const activity = logActivity({
      lead_id: lead.id,
      type: 'site_event',
      trigger: 'gone_cold',
      summary: `No activity in ${idle_days} days`,
      metadata: { idle_days },
    });

    const result = await suggestNextAction(lead.id, 'gone_cold');
    results.push({ lead, activity, ...result });
  }

  return results;
}
