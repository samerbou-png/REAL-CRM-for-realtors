import { listLeads } from './leads.js';
import { PIPELINE_STAGES } from '../storage/schemas.js';

const STAGE_LABELS = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  showing: 'Showing',
  offer: 'Offer',
  closed: 'Closed',
  lost: 'Lost',
};

export function getPipeline() {
  const leads = listLeads();

  const stages = PIPELINE_STAGES.map((stage) => ({
    id: stage,
    label: STAGE_LABELS[stage] ?? stage,
    leads: leads
      .filter((lead) => lead.stage === stage)
      .map((lead) => ({
        id: lead.id,
        first_name: lead.first_name,
        last_name: lead.last_name,
        email: lead.email,
        source: lead.source,
        last_activity_at: lead.last_activity_at,
      })),
  }));

  return {
    stages,
    total: leads.length,
  };
}
