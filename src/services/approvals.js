import { dataPath, readCsv, writeCsv } from '../storage/csv.js';
import { APPROVAL_HEADERS, APPROVAL_STATUSES } from '../storage/schemas.js';
import { config, ensureDataDir } from '../config.js';
import { createId, nowIso } from '../lib/id.js';
import { logActivity } from './activities.js';
import { touchLead } from './leads.js';

function approvalsFile() {
  return dataPath(config.dataDir, 'approvals.csv');
}

export function listApprovals() {
  ensureDataDir();
  return readCsv(approvalsFile());
}

export function listPendingApprovals() {
  return listApprovals()
    .filter((approval) => approval.status === 'draft')
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getApproval(approvalId) {
  return listApprovals().find((approval) => approval.id === approvalId) ?? null;
}

export function saveApprovals(approvals) {
  ensureDataDir();
  writeCsv(approvalsFile(), approvals, APPROVAL_HEADERS);
}

export function queueDraft(input) {
  const approvals = listApprovals();
  const approval = {
    id: createId('appr'),
    lead_id: input.lead_id,
    activity_id: input.activity_id ?? '',
    channel: input.channel ?? 'text',
    status: 'draft',
    trigger: input.trigger ?? '',
    summary: input.summary ?? '',
    original_draft: input.original_draft ?? '',
    final_message: '',
    confidence: input.confidence ?? 'medium',
    reason: input.reason ?? '',
    created_at: nowIso(),
    decided_at: '',
  };

  approvals.push(approval);
  saveApprovals(approvals);

  logActivity({
    lead_id: input.lead_id,
    type: 'draft',
    trigger: input.trigger,
    summary: input.summary,
    metadata: {
      approval_id: approval.id,
      confidence: approval.confidence,
    },
    model: input.model ?? '',
  });

  return approval;
}

function updateApproval(approvalId, patch) {
  const approvals = listApprovals();
  const index = approvals.findIndex((approval) => approval.id === approvalId);
  if (index === -1) {
    return null;
  }

  const next = {
    ...approvals[index],
    ...patch,
    id: approvals[index].id,
    created_at: approvals[index].created_at,
  };

  if (patch.status && !APPROVAL_STATUSES.includes(patch.status)) {
    throw new Error(`Invalid approval status: ${patch.status}`);
  }

  approvals[index] = next;
  saveApprovals(approvals);
  return next;
}

export function approveDraft(approvalId, finalMessage) {
  const current = getApproval(approvalId);
  if (!current) {
    return null;
  }
  if (current.status !== 'draft') {
    throw new Error(`Approval ${approvalId} is not in draft status`);
  }

  const approval = updateApproval(approvalId, {
    status: 'approved',
    final_message: finalMessage ?? current.original_draft,
    decided_at: nowIso(),
  });

  logActivity({
    lead_id: approval.lead_id,
    type: 'approval',
    trigger: approval.trigger,
    summary: 'Draft approved by agent',
    metadata: { approval_id: approval.id, status: 'approved' },
  });

  return approval;
}

export function rejectDraft(approvalId, reason = '') {
  const current = getApproval(approvalId);
  if (!current) {
    return null;
  }
  if (current.status !== 'draft') {
    throw new Error(`Approval ${approvalId} is not in draft status`);
  }

  const approval = updateApproval(approvalId, {
    status: 'rejected',
    reason: reason || current.reason,
    decided_at: nowIso(),
  });

  logActivity({
    lead_id: approval.lead_id,
    type: 'approval',
    trigger: approval.trigger,
    summary: 'Draft rejected by agent',
    metadata: { approval_id: approval.id, status: 'rejected', reason },
  });

  return approval;
}

export function markSent(approvalId) {
  const current = getApproval(approvalId);
  if (!current) {
    return null;
  }
  if (current.status !== 'approved') {
    throw new Error(`Approval ${approvalId} must be approved before sending`);
  }

  const approval = updateApproval(approvalId, {
    status: 'sent',
    decided_at: nowIso(),
  });

  logActivity({
    lead_id: approval.lead_id,
    type: approval.channel === 'email' ? 'email' : 'text',
    trigger: approval.trigger,
    summary: 'Message sent after explicit agent action',
    metadata: {
      approval_id: approval.id,
      final_message: approval.final_message,
    },
  });

  touchLead(approval.lead_id, { touched: true });
  return approval;
}
