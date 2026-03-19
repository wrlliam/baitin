import { redis } from "@/db/redis";
import { db } from "@/db";
import { gameEvents, events as eventsList } from "@/data";
import { fishingProfile, guildSettings } from "@/db/schema";
import type { GameEvent } from "@/data/types";
import type { Client } from "discord.js";
import { ui } from "@/ui";
import config from "@/config";

const ACTIVE_EVENT_KEY = "fish:event:active";
const NEXT_EVENT_KEY = "fish:event:next";
const MIN_INTERVAL_MS = 5 * 60 * 60 * 1000; // 5 hours
const MAX_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

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

const EFFECT_EMOJIS: Record<string, string> = {
  xp_multiplier: "📖",
  catch_rate: "🎣",
  rarity_boost: "✨",
  coin_multiplier: "💰",
};

const EFFECT_LABELS: Record<string, string> = {
  xp_multiplier: "XP Multiplier",
  catch_rate: "Catch Rate",
  rarity_boost: "Rarity Boost",
  coin_multiplier: "Coin Multiplier",
};

export async function broadcastEventAnnouncement(
  event: GameEvent,
  client: Client,
): Promise<void> {
  const durationMins = Math.round(event.duration / 60000);
  const effectLines = event.effects
    .map((e) => {
      const emoji = EFFECT_EMOJIS[e.type] ?? "•";
      const label = EFFECT_LABELS[e.type] ?? e.type.replace(/_/g, " ");
      const isDebuff = e.value < 1;
      return `${emoji} **${label}:** ×${e.value}${isDebuff ? " ⬇" : ""}`;
    })
    .join("\n");

  const detailLines: string[] = [];
  detailLines.push(`⏱️ **Duration:** ${durationMins} minutes`);
  if (event.entryFee) {
    detailLines.push(`${config.emojis.coin} **Entry Fee:** ${event.entryFee.toLocaleString()} — use \`/event join\``);
  } else {
    detailLines.push("🆓 **Entry:** Free — effects apply automatically when you `/cast`");
  }

  const announcement = ui()
    .color(0x2b7fff)
    .title(`${config.emojis.event} ${event.name} is LIVE!`)
    .text(event.description)
    .divider()
    .text(effectLines)
    .divider()
    .text(detailLines.join("\n"))
    .footer("Use /event info for details • /cast to fish with event effects")
    .build();

  // Get all guild settings with configured channels
  const allSettings = await db.select().from(guildSettings);
  const channelMap = new Map(
    allSettings
      .filter((s) => s.eventNotificationChannelId)
      .map((s) => [s.guildId, s.eventNotificationChannelId!]),
  );

  for (const guild of client.guilds.cache.values()) {
    try {
      const channelId = channelMap.get(guild.id);
      if (!channelId) continue; // No channel configured, skip

      const channel = guild.channels.cache.get(channelId);
      if (!channel || channel.type !== 0) continue; // Not a valid text channel

      await (channel as any).send(announcement as any);
    } catch {
      // Skip guilds where we can't send
    }
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

async function scheduleNextEvent(force = false): Promise<void> {
  if (!force) {
    const existing = await redis.get(NEXT_EVENT_KEY);
    if (existing) return; // Already scheduled
  }
  const delay = MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS);
  const nextAt = Date.now() + delay;
  await redis.set(NEXT_EVENT_KEY, nextAt.toString());
}

export function startEventScheduler(client?: Client) {
  if (schedulerInterval) return;
  if (client) schedulerClient = client;

  // Schedule next event if not already scheduled
  scheduleNextEvent().catch(() => {});

  schedulerInterval = setInterval(async () => {
    try {
      const active = await getActiveEvent();
      if (active) return;

      const nextAtStr = await redis.get(NEXT_EVENT_KEY);
      if (!nextAtStr) {
        await scheduleNextEvent();
        return;
      }

      const nextAt = parseInt(nextAtStr);
      if (Date.now() < nextAt) return;

      // Time to trigger!
      const randomEvent = eventsList[Math.floor(Math.random() * eventsList.length)];
      await activateEvent(randomEvent.id);
      if (schedulerClient) {
        await broadcastEventAnnouncement(randomEvent, schedulerClient);
      }

      // Schedule the next one
      await scheduleNextEvent(true);
    } catch {}
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
