import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export type PersistedApiState = {
  users: unknown[];
  recipients: unknown[];
  envelopes: unknown[];
  intents: unknown[];
  payments: unknown[];
  notifications: unknown[];
  settlements: unknown[];
  ledgerEntries: unknown[];
  auditEvents: unknown[];
  workerJobs: unknown[];
};

const defaultState = (): PersistedApiState => ({
  users: [],
  recipients: [],
  envelopes: [],
  intents: [],
  payments: [],
  notifications: [],
  settlements: [],
  ledgerEntries: [],
  auditEvents: [],
  workerJobs: []
});

export const createJsonStateStore = (filePath: string) => ({
  read(): PersistedApiState {
    if (!existsSync(filePath)) {
      return defaultState();
    }

    const raw = readFileSync(filePath, "utf8");
    return { ...defaultState(), ...JSON.parse(raw) };
  },
  write(state: PersistedApiState): void {
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(state, null, 2));
  }
});
