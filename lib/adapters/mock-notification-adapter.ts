import "server-only";

import type { NotificationMessage, NotificationReceipt, NotificationsAdapter } from "./interfaces";

export const createMockNotificationsAdapter = (): NotificationsAdapter => ({
  async send(message: NotificationMessage): Promise<NotificationReceipt> {
    const serialized = JSON.stringify(message);
    const hash = Array.from(serialized).reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 0).toString(16).padStart(8, "0");
    return {
      id: `mock-notification-${hash}`,
      status: message.channel === "in_app" ? "queued" : "sent",
      channel: message.channel,
      sentAt: "2026-07-18T00:00:00.000Z",
    };
  },
});
