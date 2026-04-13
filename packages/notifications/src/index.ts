export type NotificationEvent = {
  id?: string;
  type: string;
  channel: "email" | "xmtp" | "webhook";
  recipient: string;
  payload: Record<string, unknown>;
};

export type NotificationService = {
  emit: (event: NotificationEvent) => Promise<NotificationEvent>;
  hydrate: (events: NotificationEvent[]) => void;
  list: () => NotificationEvent[];
};

export const createNotificationService = ({
  emailWebhookUrl,
  xmtpWebhookUrl,
  webhookUrl
}: {
  emailWebhookUrl?: string;
  xmtpWebhookUrl?: string;
  webhookUrl?: string;
} = {}): NotificationService => {
  const events: NotificationEvent[] = [];

  return {
    async emit(event) {
      const enriched = {
        ...event,
        id: event.id ?? `ntf_${events.length + 1}`
      };

      events.push(enriched);

      const targetUrl =
        event.channel === "email"
          ? emailWebhookUrl
          : event.channel === "xmtp"
            ? xmtpWebhookUrl
            : webhookUrl;

      if (targetUrl) {
        await fetch(targetUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(enriched)
        });
      }

      return enriched;
    },
    hydrate(seedEvents) {
      events.splice(
        0,
        events.length,
        ...seedEvents.map((event, index) => ({
          ...event,
          id: event.id ?? `ntf_${index + 1}`
        }))
      );
    },
    list: () => [...events]
  };
};
