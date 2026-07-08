import { getLeadFeed } from './services/leadFeed.js';
import { listPendingApprovals } from './services/approvals.js';

const command = process.argv[2];

if (command === 'feed') {
  const feed = getLeadFeed({ limit: Number(process.argv[3] ?? 10) });
  for (const item of feed) {
    console.log(`[${item.priority_score}] ${item.first_name} ${item.last_name} (${item.stage})`);
    console.log(`  reasons: ${item.reasons.join('; ')}`);
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

console.log(`Usage:
  node src/cli.js feed [limit]
  node src/cli.js approvals`);

process.exit(command ? 1 : 0);
