import { redis } from "@/db/redis";
import { gameEvents, events as eventsList } from "@/data";
import type { GameEvent } from "@/data/types";

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

export async function triggerEvent(eventId: string): Promise<GameEvent | null> {
  const event = gameEvents.get(eventId);
  if (!event) return null;

  await activateEvent(eventId);
  return event;
}

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

export function startEventScheduler() {
  if (schedulerInterval) return;

  schedulerInterval = setInterval(async () => {
    const active = await getActiveEvent();
    if (active) return; // Already an event running

    // ~2% chance per check (every 60s) to trigger a random event
    if (Math.random() < 0.02) {
      const randomEvent = eventsList[Math.floor(Math.random() * eventsList.length)];
      await activateEvent(randomEvent.id);
    }
  }, 60 * 1000);
}

export function stopEventScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}
