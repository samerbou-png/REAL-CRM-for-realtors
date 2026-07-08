import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config, ensureDataDir } from './config.js';
import { getLeadFeed, getLeadFeedWithInsights } from './services/leadFeed.js';
import { createLead, getLead, listLeads, updateLead } from './services/leads.js';
import { listActivitiesForLead, logActivity } from './services/activities.js';
import {
  approveDraft,
  getApproval,
  listPendingApprovals,
  markSent,
  rejectDraft,
} from './services/approvals.js';
import { recordSiteEvent, listSupportedTriggers } from './services/reactive.js';
import { isOllamaAvailable, summarizeLead } from './services/ollama.js';
import { findGoneColdLeads, processGoneColdLeads } from './services/coldLeads.js';
import {
  createCampaign,
  addCampaignStep,
  enrollLead,
  listCampaignsWithMeta,
  processDueCampaignSteps,
} from './services/campaigns.js';
import { getPipeline } from './services/pipeline.js';

const publicDir = resolve(import.meta.dirname, '../public');

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (!chunks.length) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function serveStatic(res, fileName) {
  const filePath = resolve(publicDir, fileName);
  if (!existsSync(filePath)) {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }
  const content = readFileSync(filePath);
  const type = fileName.endsWith('.html') ? 'text/html' : 'text/css';
  res.writeHead(200, { 'Content-Type': type });
  res.end(content);
}

export function createAppServer() {
  ensureDataDir();

  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
      const { pathname } = url;

      if (req.method === 'GET' && pathname === '/') {
        serveStatic(res, 'index.html');
        return;
      }

      if (req.method === 'GET' && pathname === '/styles.css') {
        serveStatic(res, 'styles.css');
        return;
      }

      if (req.method === 'GET' && pathname === '/api/health') {
        sendJson(res, 200, {
          ok: true,
          ollama: await isOllamaAvailable(),
          timezone: config.timezone,
        });
        return;
      }

      if (req.method === 'GET' && pathname === '/api/feed') {
        const limit = Number(url.searchParams.get('limit') ?? 10);
        const insights = url.searchParams.get('insights') === '1';
        const feed = insights
          ? await getLeadFeedWithInsights({ limit })
          : getLeadFeed({ limit });
        sendJson(res, 200, { feed });
        return;
      }

      if (req.method === 'GET' && pathname.startsWith('/api/leads/') && pathname.endsWith('/insight')) {
        const leadId = pathname.split('/')[3];
        const insight = await summarizeLead(leadId);
        sendJson(res, 200, { insight });
        return;
      }

      if (req.method === 'GET' && pathname === '/api/leads') {
        sendJson(res, 200, { leads: listLeads() });
        return;
      }

      if (req.method === 'GET' && pathname === '/api/pipeline') {
        sendJson(res, 200, getPipeline());
        return;
      }

      if (req.method === 'GET' && pathname.startsWith('/api/leads/')) {
        const parts = pathname.split('/');
        const leadId = parts[3];
        if (parts[4]) {
          sendJson(res, 404, { error: 'Not found' });
          return;
        }
        const lead = getLead(leadId);
        if (!lead) {
          sendJson(res, 404, { error: 'Lead not found' });
          return;
        }
        sendJson(res, 200, {
          lead,
          activities: listActivitiesForLead(leadId),
        });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/leads') {
        const body = await readJson(req);
        const lead = createLead(body);
        sendJson(res, 201, { lead });
        return;
      }

      if (req.method === 'PATCH' && pathname.startsWith('/api/leads/')) {
        const leadId = pathname.split('/').pop();
        const body = await readJson(req);
        const lead = updateLead(leadId, body);
        if (!lead) {
          sendJson(res, 404, { error: 'Lead not found' });
          return;
        }
        sendJson(res, 200, { lead });
        return;
      }

      if (req.method === 'GET' && pathname === '/api/approvals/pending') {
        sendJson(res, 200, { approvals: listPendingApprovals() });
        return;
      }

      if (req.method === 'GET' && pathname.startsWith('/api/approvals/')) {
        const approvalId = pathname.split('/').pop();
        const approval = getApproval(approvalId);
        if (!approval) {
          sendJson(res, 404, { error: 'Approval not found' });
          return;
        }
        sendJson(res, 200, { approval });
        return;
      }

      if (req.method === 'POST' && pathname.startsWith('/api/approvals/') && pathname.endsWith('/approve')) {
        const approvalId = pathname.split('/')[3];
        const body = await readJson(req);
        const approval = approveDraft(approvalId, body.final_message);
        if (!approval) {
          sendJson(res, 404, { error: 'Approval not found' });
          return;
        }
        sendJson(res, 200, { approval });
        return;
      }

      if (req.method === 'POST' && pathname.startsWith('/api/approvals/') && pathname.endsWith('/reject')) {
        const approvalId = pathname.split('/')[3];
        const body = await readJson(req);
        const approval = rejectDraft(approvalId, body.reason);
        if (!approval) {
          sendJson(res, 404, { error: 'Approval not found' });
          return;
        }
        sendJson(res, 200, { approval });
        return;
      }

      if (req.method === 'POST' && pathname.startsWith('/api/approvals/') && pathname.endsWith('/send')) {
        const approvalId = pathname.split('/')[3];
        const approval = markSent(approvalId);
        if (!approval) {
          sendJson(res, 404, { error: 'Approval not found' });
          return;
        }
        sendJson(res, 200, { approval });
        return;
      }

      if (req.method === 'POST' && pathname.startsWith('/api/leads/') && pathname.endsWith('/events')) {
        const leadId = pathname.split('/')[3];
        const body = await readJson(req);
        const result = await recordSiteEvent(leadId, body.trigger, body.summary);
        sendJson(res, 201, result);
        return;
      }

      if (req.method === 'POST' && pathname.startsWith('/api/leads/') && pathname.endsWith('/notes')) {
        const leadId = pathname.split('/')[3];
        const body = await readJson(req);
        const activity = logActivity({
          lead_id: leadId,
          type: 'note',
          trigger: body.trigger ?? 'manual',
          summary: body.summary,
        });
        sendJson(res, 201, { activity });
        return;
      }

      if (req.method === 'GET' && pathname === '/api/triggers') {
        sendJson(res, 200, { triggers: listSupportedTriggers() });
        return;
      }

      if (req.method === 'GET' && pathname === '/api/cold-leads') {
        sendJson(res, 200, { cold_leads: findGoneColdLeads() });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/cold-leads/process') {
        const results = await processGoneColdLeads();
        sendJson(res, 200, { processed: results.length, results });
        return;
      }

      if (req.method === 'GET' && pathname === '/api/campaigns') {
        sendJson(res, 200, { campaigns: listCampaignsWithMeta() });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/campaigns') {
        const body = await readJson(req);
        const campaign = createCampaign(body);
        sendJson(res, 201, { campaign });
        return;
      }

      if (req.method === 'POST' && pathname.startsWith('/api/campaigns/') && pathname.endsWith('/steps')) {
        const campaignId = pathname.split('/')[3];
        const body = await readJson(req);
        const step = addCampaignStep(campaignId, body);
        sendJson(res, 201, { step });
        return;
      }

      if (req.method === 'POST' && pathname.startsWith('/api/campaigns/') && pathname.endsWith('/enroll')) {
        const campaignId = pathname.split('/')[3];
        const body = await readJson(req);
        const enrollment = enrollLead(campaignId, body.lead_id);
        sendJson(res, 201, { enrollment });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/campaigns/process') {
        const results = await processDueCampaignSteps();
        sendJson(res, 200, { processed: results.length, results });
        return;
      }

      sendJson(res, 404, { error: 'Not found' });
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
  });
}

export function startServer() {
  const server = createAppServer();
  server.listen(config.port, () => {
    console.log(`REAL CRM running at http://localhost:${config.port}`);
  });
  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}
