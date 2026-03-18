import { redis } from "@/db/redis";
import { db } from "@/db";
import { gameEvents, events as eventsList } from "@/data";
import { fishingProfile } from "@/db/schema";
import { ne } from "drizzle-orm";
import type { GameEvent } from "@/data/types";
import type { Client, Guild } from "discord.js";
import { MessageFlags } from "discord.js";
import { ui } from "@/ui";
import config from "@/config";

const ACTIVE_EVENT_KEY = "fish:event:active";

export async function getActiveEvent(): Promise<GameEvent | null> {
  const data = await redis.get(ACTIVE_EVENT_KEY);
  if (!data) return null;
  return JSON.parse(data) as GameEvent;
}

export async function activateEvent(eventId: string): Promise<boolean> {
  const event = gameEvents.get(eventId);
  if (!event) return false;

  const ttlSeconds = Math.floor(event.duration / 1000);
  await redis.set(ACTIVE_EVENT_KEY, JSON.stringify(event));
  await redis.send("EXPIRE", [ACTIVE_EVENT_KEY, ttlSeconds.toString()]);

  return true;
}

export async function broadcastEventAnnouncement(
  event: GameEvent,
  client: Client,
): Promise<void> {
  const durationMins = Math.round(event.duration / 60000);
  const effectLines = event.effects
    .map((e) => `• **${e.type.replace(/_/g, " ")}:** ×${e.value}`)
    .join("\n");
  const entryLine = event.entryFee
    ? `\n• **Entry Fee:** ${event.entryFee.toLocaleString()} ${config.emojis.coin}`
    : "";

  const announcement = ui()
    .color(0x2b7fff)
    .title(`🎪 **${event.name}** is LIVE!`)
    .text(event.description)
    .divider()
    .text(
      `**Effects:**\n${effectLines}\n\n**Duration:** ${durationMins} minutes${entryLine}`,
    )
    .divider()
    .text(
      `Use **\`/event\`** to see details. Use **\`/settings event-notifications\`** to toggle these announcements.`,
    )
    .build();

  try {
    for (const guild of client.guilds.cache.values()) {
      try {
        // Find a text channel the bot can send to
        const channel = guild.channels.cache.find(
          (ch) =>
            ch.type === 0 && // GuildText
            ch.permissionsFor(guild.members.me!)?.has("SendMessages"),
        );

        if (!channel) continue;

        // Get users with event notifications enabled
        const usersWithNotifs = await db
          .select({ userId: fishingProfile.userId })
          .from(fishingProfile)
          .where(ne(fishingProfile.eventNotifications, false));

        // Only send if at least one member in the guild has notifications enabled
        const hasEnabledUser = usersWithNotifs.some((u) =>
          guild.members.cache.has(u.userId),
        );

        if (hasEnabledUser) {
          await (channel as any).send(announcement as any);
        }
      } catch {
        // Skip guilds where we can't send
      }
    }
  } catch {
    // Silently fail if can't broadcast
  }
}

export async function triggerEvent(eventId: string): Promise<GameEvent | null> {
  const event = gameEvents.get(eventId);
  if (!event) return null;

  await activateEvent(eventId);
  return event;
}

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let schedulerClient: Client | null = null;

export function startEventScheduler(client?: Client) {
  if (schedulerInterval) return;
  if (client) schedulerClient = client;

  schedulerInterval = setInterval(async () => {
    const active = await getActiveEvent();
    if (active) return; // Already an event running

    // ~2% chance per check (every 60s) to trigger a random event
    if (Math.random() < 0.02) {
      const randomEvent = eventsList[Math.floor(Math.random() * eventsList.length)];
      await activateEvent(randomEvent.id);
      if (schedulerClient) {
        await broadcastEventAnnouncement(randomEvent, schedulerClient);
      }
    }
  }, 60 * 1000);
}

export function stopEventScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}

export async function stopEvent(): Promise<boolean> {
  const active = await getActiveEvent();
  if (!active) return false;
  await redis.del(ACTIVE_EVENT_KEY);
  return true;
}

export async function checkScheduledEvents(client?: Client): Promise<void> {
  const active = await getActiveEvent();
  if (active) return; // Already an event running

  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();

  // Morning Rush: activate at 07:00 UTC (within first 5 minutes)
  if (utcHour === 7 && utcMinute < 5) {
    const event = gameEvents.get("morning_rush");
    await activateEvent("morning_rush");
    if (client && event) {
      await broadcastEventAnnouncement(event, client);
    }
  }
}
