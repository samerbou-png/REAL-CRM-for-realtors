export const LEAD_HEADERS = [
  'id',
  'first_name',
  'last_name',
  'email',
  'phone',
  'stage',
  'source',
  'notes',
  'last_activity_at',
  'last_touch_at',
  'created_at',
];

export const ACTIVITY_HEADERS = [
  'id',
  'lead_id',
  'type',
  'trigger',
  'summary',
  'metadata',
  'model',
  'created_at',
];

export const APPROVAL_HEADERS = [
  'id',
  'lead_id',
  'activity_id',
  'channel',
  'status',
  'trigger',
  'summary',
  'original_draft',
  'final_message',
  'confidence',
  'reason',
  'enrollment_id',
  'step_id',
  'created_at',
  'decided_at',
];

export const CAMPAIGN_HEADERS = ['id', 'name', 'enabled', 'created_at'];

export const CAMPAIGN_STEP_HEADERS = [
  'id',
  'campaign_id',
  'step_order',
  'channel',
  'delay_days',
  'summary',
  'draft_template',
  'created_at',
];

export const ENROLLMENT_HEADERS = [
  'id',
  'campaign_id',
  'lead_id',
  'status',
  'current_step',
  'pending_approval_id',
  'enrolled_at',
  'next_step_at',
  'completed_at',
];

export const ENROLLMENT_STATUSES = [
  'active',
  'pending_approval',
  'paused',
  'completed',
];

export const PIPELINE_STAGES = [
  'new',
  'contacted',
  'qualified',
  'showing',
  'offer',
  'closed',
  'lost',
];

export const ACTIVITY_TYPES = [
  'note',
  'call',
  'text',
  'email',
  'site_event',
  'task',
  'draft',
  'approval',
];

export const APPROVAL_STATUSES = ['draft', 'approved', 'sent', 'rejected'];
