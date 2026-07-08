import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

export const config = {
  dataDir: resolve(root, process.env.DATA_DIR ?? './data'),
  port: Number(process.env.PORT ?? 3000),
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434/v1',
  ollamaModel: process.env.OLLAMA_MODEL ?? 'qwen2.5-coder:7b',
  quietHoursStart: Number(process.env.QUIET_HOURS_START ?? 21),
  quietHoursEnd: Number(process.env.QUIET_HOURS_END ?? 8),
  timezone: process.env.TZ ?? 'America/New_York',
};

export function ensureDataDir() {
  if (!existsSync(config.dataDir)) {
    mkdirSync(config.dataDir, { recursive: true });
  }
}
