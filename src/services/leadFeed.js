import { listActivitiesForLead } from './activities.js';
import { listLeads } from './leads.js';
import { summarizeLead } from './ollama.js';

const STAGE_URGENCY = {
  offer: 20,
  showing: 16,
  qualified: 12,
  contacted: 8,
  new: 6,
  closed: 0,
  lost: 0,
};

const INTENT_WEIGHTS = {
  form_submit: 20,
  saved_listing: 15,
  repeat_view: 12,
  returned_after_idle: 10,
  replied: 18,
  call_requested: 16,
  gone_cold: 14,
};

function hoursSince(isoDate) {
  if (!isoDate) {
    return Number.POSITIVE_INFINITY;
  }
  const diffMs = Date.now() - new Date(isoDate).getTime();
  return diffMs / (1000 * 60 * 60);
}

function daysSince(isoDate) {
  return hoursSince(isoDate) / 24;
}

function scoreIntentSignals(activities) {
  const triggers = new Set(
    activities
      .map((activity) => activity.trigger)
      .filter(Boolean),
  );

  let score = 0;
  const reasons = [];

  for (const [trigger, weight] of Object.entries(INTENT_WEIGHTS)) {
    if (triggers.has(trigger)) {
      score += weight;
      reasons.push(trigger.replaceAll('_', ' '));
    }
  }

  const repeatViews = activities.filter((activity) => activity.trigger === 'repeat_view').length;
  if (repeatViews >= 3) {
    score += 8;
    reasons.push('3+ listing views');
  }

  return {
    score: Math.min(score, 40),
    reasons,
  };
}

function scoreRecency(lastActivityAt) {
  const hours = hoursSince(lastActivityAt);
  if (hours <= 2) {
    return { score: 30, reason: 'active in last 2 hours' };
  }
  if (hours <= 24) {
    return { score: 24, reason: 'active in last 24 hours' };
  }
  if (hours <= 72) {
    return { score: 16, reason: 'active in last 3 days' };
  }
  if (hours <= 168) {
    return { score: 8, reason: 'active in last week' };
  }
  return { score: 0, reason: 'no recent activity' };
}

function scoreStageUrgency(stage) {
  const score = STAGE_URGENCY[stage] ?? 0;
  if (!score) {
    return { score: 0, reason: '' };
  }
  return { score, reason: `pipeline stage: ${stage}` };
}

function scoreStaleness(lastTouchAt, lastActivityAt) {
  const reference = lastTouchAt || lastActivityAt;
  const days = daysSince(reference);
  if (days >= 7) {
    return { score: 20, reason: `no agent touch in ${Math.floor(days)} days` };
  }
  if (days >= 3) {
    return { score: 10, reason: `no agent touch in ${Math.floor(days)} days` };
  }
  return { score: 0, reason: '' };
}

export function scoreLead(lead, activities = null) {
  const leadActivities = activities ?? listActivitiesForLead(lead.id);
  const intent = scoreIntentSignals(leadActivities);
  const recency = scoreRecency(lead.last_activity_at);
  const stage = scoreStageUrgency(lead.stage);
  const stale = scoreStaleness(lead.last_touch_at, lead.last_activity_at);

  const total = intent.score + recency.score + stage.score - stale.score;
  const reasons = [
    ...intent.reasons.map((reason) => `intent: ${reason}`),
    recency.reason,
    stage.reason,
    stale.reason,
  ].filter(Boolean);

  return {
    lead_id: lead.id,
    priority_score: Math.max(total, 0),
    breakdown: {
      intent_signals: intent.score,
      recency: recency.score,
      stage_urgency: stage.score,
      staleness_penalty: stale.score,
    },
    reasons,
  };
}

export function getLeadFeed({ limit = 10, includeClosed = false } = {}) {
  const leads = listLeads().filter((lead) => includeClosed || !['closed', 'lost'].includes(lead.stage));

  const feed = leads.map((lead) => {
    const scoring = scoreLead(lead);
    return {
      ...lead,
      ...scoring,
    };
  });

  feed.sort((a, b) => b.priority_score - a.priority_score || b.last_activity_at.localeCompare(a.last_activity_at));
  return feed.slice(0, limit);
}

export async function getLeadFeedWithInsights({ limit = 10, includeClosed = false } = {}) {
  const feed = getLeadFeed({ limit, includeClosed });
  const enriched = [];

  for (const lead of feed) {
    const insight = await summarizeLead(lead.id);
    enriched.push({
      ...lead,
      ai_insight: insight,
    });
  }

  return enriched;
}
