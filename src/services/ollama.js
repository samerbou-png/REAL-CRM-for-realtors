import { config } from '../config.js';
import { listActivitiesForLead } from './activities.js';
import { getLead } from './leads.js';
import { queueDraft } from './approvals.js';
import { logActivity } from './activities.js';
import { scoreLead } from './leadFeed.js';

const SENSITIVE_KEYWORDS = ['legal', 'financing', 'mortgage', 'offer', 'contract', 'lawsuit'];

export function isQuietHours(date = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: config.timezone,
    }).format(date),
  );

  const start = config.quietHoursStart;
  const end = config.quietHoursEnd;

  if (start > end) {
    return hour >= start || hour < end;
  }
  return hour >= start && hour < end;
}

function containsSensitiveTopic(text) {
  const lower = text.toLowerCase();
  return SENSITIVE_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function personalize(template, lead) {
  const name = lead.first_name || 'there';
  return template.replaceAll('{{first_name}}', name);
}

export async function requestOllamaJson(prompt) {
  const response = await fetch(`${config.ollamaBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.ollamaModel,
      messages: [
        { role: 'system', content: 'Return valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed: ${response.status}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content ?? '';
  const jsonText = content.match(/\{[\s\S]*\}/)?.[0] ?? content;
  return JSON.parse(jsonText);
}

function buildActionPrompt(lead, activities, trigger) {
  const facts = [
    `Name: ${lead.first_name} ${lead.last_name}`.trim(),
    lead.email ? `Email: ${lead.email}` : null,
    lead.phone ? `Phone: ${lead.phone}` : null,
    `Stage: ${lead.stage}`,
    lead.notes ? `Notes: ${lead.notes}` : null,
    `Trigger: ${trigger}`,
    'Recent activity:',
    ...activities.slice(0, 8).map((activity) => `- ${activity.type}: ${activity.summary || activity.trigger}`),
  ]
    .filter(Boolean)
    .join('\n');

  return `You are an assistant to a licensed realtor. Use only the facts below. Do not invent listings, prices, or legal advice.

${facts}

Respond with JSON only:
{
  "summary": "one sentence on why to act now",
  "suggested_action": "call|text|email|task",
  "draft_message": "short draft or null",
  "confidence": "high|medium|low",
  "escalate": false,
  "reason": "explainable priority reason"
}`;
}

function buildInsightPrompt(lead, scoring, activities) {
  return `You are an assistant to a licensed realtor. Summarize why this lead needs attention using only the facts below.

Lead: ${lead.first_name} ${lead.last_name}
Stage: ${lead.stage}
Priority score: ${scoring.priority_score}
Reasons: ${scoring.reasons.join('; ')}
Notes: ${lead.notes || 'none'}
Recent activity:
${activities.slice(0, 6).map((activity) => `- ${activity.summary || activity.trigger}`).join('\n')}

Respond with JSON only:
{
  "headline": "short why-this-lead-is-hot line",
  "next_action": "call|text|email|task",
  "talking_point": "one sentence the agent can use on a call"
}`;
}

function fallbackSuggestion(lead, trigger) {
  const name = lead.first_name || 'there';
  return {
    summary: `${name} triggered ${trigger.replaceAll('_', ' ')} and needs follow-up.`,
    suggested_action: 'text',
    draft_message: `Hi ${name}, I saw your recent activity and wanted to check in. Are you available for a quick call today?`,
    confidence: 'medium',
    escalate: false,
    reason: `reactive trigger: ${trigger}`,
  };
}

function fallbackInsight(lead, scoring) {
  const topReason = scoring.reasons[0] ?? 'recent activity';
  return {
    headline: `${lead.first_name} is prioritized because of ${topReason}.`,
    next_action: 'call',
    talking_point: `Reference ${topReason} and ask about their timeline.`,
  };
}

export async function summarizeLead(leadId) {
  const lead = getLead(leadId);
  if (!lead) {
    throw new Error(`Lead not found: ${leadId}`);
  }

  const activities = listActivitiesForLead(leadId);
  const scoring = scoreLead(lead, activities);

  try {
    const insight = await requestOllamaJson(buildInsightPrompt(lead, scoring, activities));
    return {
      lead_id: leadId,
      model: config.ollamaModel,
      ...insight,
    };
  } catch {
    return {
      lead_id: leadId,
      model: 'fallback',
      ...fallbackInsight(lead, scoring),
    };
  }
}

export async function suggestNextAction(leadId, trigger, options = {}) {
  const lead = getLead(leadId);
  if (!lead) {
    throw new Error(`Lead not found: ${leadId}`);
  }

  const activities = listActivitiesForLead(leadId);
  const combinedText = [lead.notes, ...activities.map((activity) => activity.summary)].join(' ');

  if (containsSensitiveTopic(combinedText)) {
    const task = logActivity({
      lead_id: leadId,
      type: 'task',
      trigger,
      summary: 'Call lead personally — sensitive topic detected',
      metadata: { escalate: true },
    });

    return {
      escalate: true,
      task,
      suggestion: null,
      quiet_hours: isQuietHours(),
    };
  }

  let suggestion;
  if (options.draft_template) {
    suggestion = {
      summary: options.summary ?? `Follow up for ${trigger}`,
      suggested_action: options.channel === 'email' ? 'email' : 'text',
      draft_message: personalize(options.draft_template, lead),
      confidence: 'medium',
      escalate: false,
      reason: options.reason ?? trigger,
    };
  } else {
    try {
      suggestion = await requestOllamaJson(buildActionPrompt(lead, activities, trigger));
    } catch {
      suggestion = fallbackSuggestion(lead, trigger);
    }
  }

  if (suggestion.escalate || suggestion.confidence === 'low' || suggestion.suggested_action === 'task') {
    const task = logActivity({
      lead_id: leadId,
      type: 'task',
      trigger,
      summary: suggestion.summary || 'Call lead personally',
      metadata: { escalate: true, reason: suggestion.reason },
      model: config.ollamaModel,
    });

    return {
      escalate: true,
      task,
      suggestion,
      quiet_hours: isQuietHours(),
    };
  }

  const approval = queueDraft({
    lead_id: leadId,
    channel: suggestion.suggested_action === 'email' ? 'email' : 'text',
    trigger,
    summary: suggestion.summary,
    original_draft: suggestion.draft_message ?? '',
    confidence: suggestion.confidence,
    reason: suggestion.reason,
    model: config.ollamaModel,
    enrollment_id: options.enrollment_id ?? '',
    step_id: options.step_id ?? '',
  });

  return {
    escalate: false,
    approval,
    suggestion,
    quiet_hours: isQuietHours(),
  };
}

export async function isOllamaAvailable() {
  try {
    const response = await fetch(`${config.ollamaBaseUrl.replace(/\/v1$/, '')}/api/tags`);
    return response.ok;
  } catch {
    return false;
  }
}
