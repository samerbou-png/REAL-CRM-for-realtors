import { dataPath, readCsv, writeCsv } from '../storage/csv.js';
import { ACTIVITY_HEADERS, ACTIVITY_TYPES } from '../storage/schemas.js';
import { config, ensureDataDir } from '../config.js';
import { createId, nowIso } from '../lib/id.js';
import { touchLead } from './leads.js';

function activitiesFile() {
  return dataPath(config.dataDir, 'activities.csv');
}

export function listActivities() {
  ensureDataDir();
  return readCsv(activitiesFile());
}

export function listActivitiesForLead(leadId) {
  return listActivities()
    .filter((activity) => activity.lead_id === leadId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function saveActivities(activities) {
  ensureDataDir();
  writeCsv(activitiesFile(), activities, ACTIVITY_HEADERS);
}

export function logActivity(input) {
  if (!ACTIVITY_TYPES.includes(input.type)) {
    throw new Error(`Invalid activity type: ${input.type}`);
  }

  const activities = listActivities();
  const activity = {
    id: createId('act'),
    lead_id: input.lead_id,
    type: input.type,
    trigger: input.trigger ?? '',
    summary: input.summary ?? '',
    metadata: input.metadata ? JSON.stringify(input.metadata) : '',
    model: input.model ?? '',
    created_at: nowIso(),
  };

  activities.push(activity);
  saveActivities(activities);

  const touched = ['call', 'text', 'email'].includes(input.type);
  touchLead(input.lead_id, { activityAt: activity.created_at, touched });

  return activity;
}
