import { getLeadFeed, getLeadFeedWithInsights } from './services/leadFeed.js';
import { listPendingApprovals } from './services/approvals.js';
import { findGoneColdLeads, processGoneColdLeads } from './services/coldLeads.js';
import {
  listCampaignsWithMeta,
  processDueCampaignSteps,
} from './services/campaigns.js';

const command = process.argv[2];

if (command === 'feed') {
  const withInsights = process.argv.includes('--insights');
  const limitArg = process.argv.find((arg) => /^\d+$/.test(arg));
  const limit = Number(limitArg ?? 10);
  const feed = withInsights
    ? await getLeadFeedWithInsights({ limit })
    : getLeadFeed({ limit });

  for (const item of feed) {
    console.log(`[${item.priority_score}] ${item.first_name} ${item.last_name} (${item.stage})`);
    console.log(`  reasons: ${item.reasons.join('; ')}`);
    if (item.ai_insight) {
      console.log(`  insight: ${item.ai_insight.headline}`);
      console.log(`  next: ${item.ai_insight.next_action} — ${item.ai_insight.talking_point}`);
    }
  }
  process.exit(0);
}

if (command === 'approvals') {
  const approvals = listPendingApprovals();
  if (!approvals.length) {
    console.log('No pending approvals.');
    process.exit(0);
  }
  for (const approval of approvals) {
    console.log(`[${approval.confidence}] ${approval.id} -> lead ${approval.lead_id}`);
    console.log(`  ${approval.summary}`);
    console.log(`  draft: ${approval.original_draft}`);
  }
  process.exit(0);
}

if (command === 'cold') {
  const coldLeads = findGoneColdLeads();
  if (!coldLeads.length) {
    console.log('No gone-cold leads detected.');
    process.exit(0);
  }
  for (const { lead, idle_days } of coldLeads) {
    console.log(`${lead.first_name} ${lead.last_name} — idle ${idle_days} days (${lead.stage})`);
  }
  process.exit(0);
}

if (command === 'process-cold') {
  const results = await processGoneColdLeads();
  console.log(`Processed ${results.length} gone-cold lead(s).`);
  process.exit(0);
}

if (command === 'campaigns') {
  const campaigns = listCampaignsWithMeta();
  for (const campaign of campaigns) {
    console.log(`${campaign.name} (${campaign.id}) — ${campaign.steps.length} steps, ${campaign.enrollments.length} enrolled`);
  }
  process.exit(0);
}

if (command === 'process-campaigns') {
  const results = await processDueCampaignSteps();
  console.log(`Queued ${results.length} drip step draft(s) for approval.`);
  process.exit(0);
}

console.log(`Usage:
  node src/cli.js feed [limit] [--insights]
  node src/cli.js approvals
  node src/cli.js cold
  node src/cli.js process-cold
  node src/cli.js campaigns
  node src/cli.js process-campaigns`);

process.exit(command ? 1 : 0);
