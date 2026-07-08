import { randomUUID } from 'node:crypto';

export function createId(prefix) {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

export function nowIso() {
  return new Date().toISOString();
}
