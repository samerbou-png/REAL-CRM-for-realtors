import { dataPath, readCsv, writeCsv } from '../storage/csv.js';
import { LEAD_HEADERS, PIPELINE_STAGES } from '../storage/schemas.js';
import { config, ensureDataDir } from '../config.js';
import { createId, nowIso } from '../lib/id.js';

function leadsFile() {
  return dataPath(config.dataDir, 'leads.csv');
}

export function listLeads() {
  ensureDataDir();
  return readCsv(leadsFile());
}

export function getLead(leadId) {
  return listLeads().find((lead) => lead.id === leadId) ?? null;
}

export function saveLeads(leads) {
  ensureDataDir();
  writeCsv(leadsFile(), leads, LEAD_HEADERS);
}

export function createLead(input) {
  const leads = listLeads();
  const lead = {
    id: createId('lead'),
    first_name: input.first_name?.trim() ?? '',
    last_name: input.last_name?.trim() ?? '',
    email: input.email?.trim() ?? '',
    phone: input.phone?.trim() ?? '',
    stage: PIPELINE_STAGES.includes(input.stage) ? input.stage : 'new',
    source: input.source?.trim() ?? 'manual',
    notes: input.notes?.trim() ?? '',
    last_activity_at: nowIso(),
    last_touch_at: input.last_touch_at ?? '',
    created_at: nowIso(),
  };
  leads.push(lead);
  saveLeads(leads);
  return lead;
}

export function updateLead(leadId, patch) {
  const leads = listLeads();
  const index = leads.findIndex((lead) => lead.id === leadId);
  if (index === -1) {
    return null;
  }

  const current = leads[index];
  const next = {
    ...current,
    ...patch,
    id: current.id,
    created_at: current.created_at,
  };

  if (patch.stage && !PIPELINE_STAGES.includes(patch.stage)) {
    throw new Error(`Invalid stage: ${patch.stage}`);
  }

  leads[index] = next;
  saveLeads(leads);
  return next;
}

export function touchLead(leadId, { activityAt, touched = false } = {}) {
  const patch = {
    last_activity_at: activityAt ?? nowIso(),
  };
  if (touched) {
    patch.last_touch_at = activityAt ?? nowIso();
  }
  return updateLead(leadId, patch);
}
