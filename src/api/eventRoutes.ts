import Elysia from "elysia";
import { redis } from "@/db/redis";
import { getActiveEvent } from "@/modules/fishing/events";
import { subtractCoins } from "@/modules/fishing/economy";
import { requireAuth } from "./auth";
import type { Client } from "discord.js";

export function createEventRoutes(_client: Client) {
  return new Elysia({ prefix: "/events" })

    // ── GET /events/active ───────────────────────────────────────────────────
    .get("/active", async ({ headers, set }) => {
      const auth = requireAuth(headers.authorization, set);
      if (!auth.ok) return auth;

      const event = await getActiveEvent();
      if (!event) {
        return { success: true, data: null };
      }

      // Check if this user has joined (only relevant for paid events)
      let joined = false;
      if (event.entryFee && event.entryFee > 0) {
        const joinedKey = `event:joined:${event.id}:${auth.userId}`;
        const val = await redis.get(joinedKey);
        joined = !!val;
      } else {
        // Free events — everyone is auto-joined
        joined = true;
      }

      // Derive endsAt from Redis TTL
      let endsAt: string | null = null;
      try {
        const ttl = await redis.send("TTL", ["fish:event:active"]);
        if (typeof ttl === "number" && ttl > 0) {
          endsAt = new Date(Date.now() + ttl * 1000).toISOString();
        }
      } catch {}

      return {
        success: true,
        data: {
          id: event.id,
          name: event.name,
          description: event.description,
          effects: event.effects,
          entryFee: event.entryFee ?? 0,
          endsAt,
          joined,
        },
      };
    })

    // ── POST /events/:eventId/join ───────────────────────────────────────────
    .post("/:eventId/join", async ({ params, headers, set }) => {
      const auth = requireAuth(headers.authorization, set);
      if (!auth.ok) return auth;

      const event = await getActiveEvent();
      if (!event) {
        set.status = 404;
        return { success: false, error: "No active event" };
      }

      if (event.id !== params.eventId) {
        set.status = 400;
        return { success: false, error: "Event is not currently active" };
      }

      const joinedKey = `event:joined:${event.id}:${auth.userId}`;
      const alreadyJoined = await redis.get(joinedKey);
      if (alreadyJoined) {
        return { success: true, data: { feePaid: 0, alreadyJoined: true } };
      }

      const feePaid = event.entryFee ?? 0;
      if (feePaid > 0) {
        const paid = await subtractCoins(auth.userId, feePaid);
        if (!paid) {
          set.status = 400;
          return { success: false, error: "Not enough coins to join this event" };
        }
      }

      // Get remaining TTL for the event so join key expires at same time
      let ttl = Math.floor((event.duration ?? 3600000) / 1000);
      try {
        const remaining = await redis.send("TTL", ["fish:event:active"]);
        if (typeof remaining === "number" && remaining > 0) ttl = remaining;
      } catch {}

      await redis.set(joinedKey, "1");
      await redis.send("EXPIRE", [joinedKey, ttl.toString()]);

      return { success: true, data: { feePaid, alreadyJoined: false } };
    });
}
