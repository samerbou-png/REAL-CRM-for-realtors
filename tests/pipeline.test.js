import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'real-crm-pipeline-'));

const { createLead } = await import('../src/services/leads.js');
const { getPipeline } = await import('../src/services/pipeline.js');
const { PIPELINE_STAGES } = await import('../src/storage/schemas.js');

test('getPipeline groups leads by stage in canonical order', () => {
  createLead({ first_name: 'New', last_name: 'Lead', stage: 'new' });
  createLead({ first_name: 'Hot', last_name: 'Buyer', stage: 'offer' });
  createLead({ first_name: 'Done', last_name: 'Deal', stage: 'closed' });

  const pipeline = getPipeline();

  assert.equal(pipeline.total, 3);
  assert.deepEqual(
    pipeline.stages.map((stage) => stage.id),
    PIPELINE_STAGES,
  );

  const newStage = pipeline.stages.find((stage) => stage.id === 'new');
  const offerStage = pipeline.stages.find((stage) => stage.id === 'offer');
  const closedStage = pipeline.stages.find((stage) => stage.id === 'closed');

  assert.equal(newStage.leads.length, 1);
  assert.equal(newStage.leads[0].first_name, 'New');
  assert.equal(offerStage.leads.length, 1);
  assert.equal(closedStage.leads.length, 1);
});

test('getPipeline returns empty columns for stages with no leads', () => {
  createLead({ first_name: 'Solo', last_name: 'Lead', stage: 'qualified' });

  const pipeline = getPipeline();
  const qualified = pipeline.stages.find((stage) => stage.id === 'qualified');
  const showing = pipeline.stages.find((stage) => stage.id === 'showing');

  assert.equal(qualified.leads.length, 1);
  assert.equal(showing.leads.length, 0);
});

test.after(() => {
  rmSync(process.env.DATA_DIR, { recursive: true, force: true });
});
