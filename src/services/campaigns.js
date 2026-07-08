import { dataPath, readCsv, writeCsv } from '../storage/csv.js';
import {
  CAMPAIGN_HEADERS,
  CAMPAIGN_STEP_HEADERS,
  ENROLLMENT_HEADERS,
} from '../storage/schemas.js';
import { config, ensureDataDir } from '../config.js';
import { createId, nowIso } from '../lib/id.js';
import { getLead } from './leads.js';
import { suggestNextAction } from './ollama.js';
import { getApproval } from './approvals.js';

function campaignsFile() {
  return dataPath(config.dataDir, 'campaigns.csv');
}

function stepsFile() {
  return dataPath(config.dataDir, 'campaign_steps.csv');
}

function enrollmentsFile() {
  return dataPath(config.dataDir, 'enrollments.csv');
}

function addDaysIso(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function listCampaigns() {
  ensureDataDir();
  return readCsv(campaignsFile());
}

export function listCampaignSteps(campaignId = null) {
  const steps = readCsv(stepsFile()).sort((a, b) => Number(a.step_order) - Number(b.step_order));
  return campaignId ? steps.filter((step) => step.campaign_id === campaignId) : steps;
}

export function listEnrollments() {
  ensureDataDir();
  return readCsv(enrollmentsFile());
}

export function getEnrollment(enrollmentId) {
  return listEnrollments().find((enrollment) => enrollment.id === enrollmentId) ?? null;
}

function saveCampaigns(rows) {
  writeCsv(campaignsFile(), rows, CAMPAIGN_HEADERS);
}

function saveSteps(rows) {
  writeCsv(stepsFile(), rows, CAMPAIGN_STEP_HEADERS);
}

function saveEnrollments(rows) {
  writeCsv(enrollmentsFile(), rows, ENROLLMENT_HEADERS);
}

export function createCampaign({ name, enabled = true }) {
  const campaigns = listCampaigns();
  const campaign = {
    id: createId('camp'),
    name,
    enabled: enabled ? 'true' : 'false',
    created_at: nowIso(),
  };
  campaigns.push(campaign);
  saveCampaigns(campaigns);
  return campaign;
}

export function addCampaignStep(campaignId, input) {
  const steps = listCampaignSteps();
  const step = {
    id: createId('step'),
    campaign_id: campaignId,
    step_order: String(input.step_order),
    channel: input.channel ?? 'text',
    delay_days: String(input.delay_days ?? 0),
    summary: input.summary ?? '',
    draft_template: input.draft_template ?? '',
    created_at: nowIso(),
  };
  steps.push(step);
  saveSteps(steps);
  return step;
}

export function enrollLead(campaignId, leadId) {
  const lead = getLead(leadId);
  if (!lead) {
    throw new Error(`Lead not found: ${leadId}`);
  }

  const campaign = listCampaigns().find((item) => item.id === campaignId);
  if (!campaign || campaign.enabled !== 'true') {
    throw new Error(`Campaign not found or disabled: ${campaignId}`);
  }

  const steps = listCampaignSteps(campaignId);
  if (!steps.length) {
    throw new Error(`Campaign ${campaignId} has no steps`);
  }

  const existing = listEnrollments().find(
    (enrollment) =>
      enrollment.campaign_id === campaignId &&
      enrollment.lead_id === leadId &&
      ['active', 'pending_approval'].includes(enrollment.status),
  );
  if (existing) {
    return existing;
  }

  const firstStep = steps[0];
  const enrollments = listEnrollments();
  const enrollment = {
    id: createId('enr'),
    campaign_id: campaignId,
    lead_id: leadId,
    status: 'active',
    current_step: firstStep.step_order,
    pending_approval_id: '',
    enrolled_at: nowIso(),
    next_step_at: addDaysIso(Number(firstStep.delay_days)),
    completed_at: '',
  };

  enrollments.push(enrollment);
  saveEnrollments(enrollments);
  return enrollment;
}

function getStepForEnrollment(enrollment) {
  return listCampaignSteps(enrollment.campaign_id).find(
    (step) => step.step_order === enrollment.current_step,
  );
}

export async function processDueCampaignSteps() {
  const now = nowIso();
  const due = listEnrollments().filter(
    (enrollment) => enrollment.status === 'active' && enrollment.next_step_at <= now,
  );

  const results = [];
  for (const enrollment of due) {
    const step = getStepForEnrollment(enrollment);
    if (!step) {
      continue;
    }

    const result = await suggestNextAction(enrollment.lead_id, `drip_step_${step.step_order}`, {
      draft_template: step.draft_template,
      summary: step.summary,
      channel: step.channel,
      reason: `drip campaign step ${step.step_order}`,
      enrollment_id: enrollment.id,
      step_id: step.id,
    });

    const enrollments = listEnrollments();
    const index = enrollments.findIndex((item) => item.id === enrollment.id);
    enrollments[index] = {
      ...enrollment,
      status: 'pending_approval',
      pending_approval_id: result.approval?.id ?? '',
    };
    saveEnrollments(enrollments);

    results.push({ enrollment: enrollments[index], step, ...result });
  }

  return results;
}

export function advanceEnrollmentAfterSend(approvalId) {
  const approval = getApproval(approvalId);
  if (!approval?.enrollment_id) {
    return null;
  }

  const enrollments = listEnrollments();
  const index = enrollments.findIndex((item) => item.id === approval.enrollment_id);
  if (index === -1) {
    return null;
  }

  const enrollment = enrollments[index];
  const steps = listCampaignSteps(enrollment.campaign_id);
  const currentIndex = steps.findIndex((step) => step.step_order === enrollment.current_step);
  const nextStep = steps[currentIndex + 1];

  if (!nextStep) {
    enrollments[index] = {
      ...enrollment,
      status: 'completed',
      pending_approval_id: '',
      completed_at: nowIso(),
      next_step_at: '',
    };
  } else {
    enrollments[index] = {
      ...enrollment,
      status: 'active',
      current_step: nextStep.step_order,
      pending_approval_id: '',
      next_step_at: addDaysIso(Number(nextStep.delay_days)),
    };
  }

  saveEnrollments(enrollments);
  return enrollments[index];
}

export function resumeEnrollmentAfterReject(approvalId) {
  const approval = getApproval(approvalId);
  if (!approval?.enrollment_id) {
    return null;
  }

  const enrollments = listEnrollments();
  const index = enrollments.findIndex((item) => item.id === approval.enrollment_id);
  if (index === -1) {
    return null;
  }

  enrollments[index] = {
    ...enrollments[index],
    status: 'active',
    pending_approval_id: '',
    next_step_at: nowIso(),
  };
  saveEnrollments(enrollments);
  return enrollments[index];
}

export function listCampaignsWithMeta() {
  return listCampaigns().map((campaign) => ({
    ...campaign,
    steps: listCampaignSteps(campaign.id),
    enrollments: listEnrollments().filter((enrollment) => enrollment.campaign_id === campaign.id),
  }));
}
