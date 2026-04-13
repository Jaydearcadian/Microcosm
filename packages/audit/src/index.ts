export type AuditEvent = {
  id: string;
  actorType: "system" | "user" | "agent" | "organization";
  actorId: string;
  eventType: string;
  objectType: string;
  objectId: string;
  payload: Record<string, unknown>;
};

export type AuditStore = {
  record: (event: AuditEvent) => AuditEvent;
  get: (id: string) => AuditEvent | undefined;
  list: () => AuditEvent[];
  hydrate: (events: AuditEvent[]) => void;
};

const clone = <T>(value: T): T => structuredClone(value);

export const createAuditStore = (): AuditStore => {
  const events: AuditEvent[] = [];

  return {
    record(event) {
      events.push(clone(event));
      return clone(event);
    },
    get(id) {
      const event = events.find((item) => item.id === id);
      return event ? clone(event) : undefined;
    },
    list() {
      return events.map((event) => clone(event));
    },
    hydrate(seedEvents) {
      events.splice(0, events.length, ...seedEvents.map((event) => clone(event)));
    }
  };
};

