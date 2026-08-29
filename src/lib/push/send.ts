import { prisma } from "@/lib/prisma";

/**
 * Thin client for Expo's push service. We POST straight to the public
 * endpoint rather than pulling in expo-server-sdk — the only two things we
 * need from it are request chunking (100 messages max per call) and reading
 * `DeviceNotRegistered` back off the ticket response to prune dead tokens,
 * both of which are a few lines here.
 *
 * https://docs.expo.dev/push-notifications/sending-notifications/
 */
const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const CHUNK_SIZE = 100;

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  /** Delivered to the app in the notification payload — used for tap-to-navigate. */
  data?: Record<string, unknown>;
  sound?: "default" | null;
  channelId?: string;
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Sends `messages` to Expo and prunes any token that comes back with a
 * `DeviceNotRegistered` ticket (app uninstalled, notifications permission
 * revoked, token rotated) so we stop trying to reach it. Never throws — a
 * push failure must not break the order-lifecycle write that triggered it.
 */
export async function sendExpoPushNotifications(messages: ExpoPushMessage[]): Promise<void> {
  if (messages.length === 0) return;

  const deadTokens: string[] = [];

  for (const batch of chunk(messages, CHUNK_SIZE)) {
    let tickets: ExpoPushTicket[] = [];
    try {
      const res = await fetch(EXPO_PUSH_ENDPOINT, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(batch),
      });
      if (!res.ok) {
        console.error(`[Push] Expo push endpoint returned ${res.status} ${res.statusText}`);
        continue;
      }
      const json = (await res.json()) as { data?: ExpoPushTicket[]; errors?: unknown };
      tickets = json.data ?? [];
    } catch (err) {
      console.error("[Push] Expo push request failed:", err);
      continue;
    }

    // Tickets are positional — ticket[i] corresponds to batch[i].
    tickets.forEach((ticket, i) => {
      if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
        deadTokens.push(batch[i].to);
      } else if (ticket.status === "error") {
        console.warn(`[Push] Expo ticket error for ${batch[i].to}: ${ticket.details?.error || ticket.message}`);
      }
    });
  }

  if (deadTokens.length > 0) {
    await prisma.deviceToken
      .deleteMany({ where: { token: { in: deadTokens } } })
      .catch((err) => console.error("[Push] Failed to prune dead tokens:", err));
  }
}
