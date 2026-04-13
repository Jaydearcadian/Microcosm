export type LedgerEntry = {
  id: string;
  accountId: string;
  entryType: "liability_hold" | "settlement_complete" | "claim_complete";
  asset: string;
  amount: string;
  referenceType: "payment" | "settlement" | "recipient";
  referenceId: string;
};

export type LedgerStore = {
  record: (entry: LedgerEntry) => LedgerEntry;
  get: (id: string) => LedgerEntry | undefined;
  list: () => LedgerEntry[];
  hydrate: (entries: LedgerEntry[]) => void;
};

const clone = <T>(value: T): T => structuredClone(value);

export const createLedgerStore = (): LedgerStore => {
  const entries: LedgerEntry[] = [];

  return {
    record(entry) {
      entries.push(clone(entry));
      return clone(entry);
    },
    get(id) {
      const entry = entries.find((item) => item.id === id);
      return entry ? clone(entry) : undefined;
    },
    list() {
      return entries.map((entry) => clone(entry));
    },
    hydrate(seedEntries) {
      entries.splice(0, entries.length, ...seedEntries.map((entry) => clone(entry)));
    }
  };
};

