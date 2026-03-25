import CoreBot from "./core/Core";
import { err, info } from "./utils/logger";
import Elysia from "elysia";
import cors from "@elysiajs/cors";
import { fish } from "@/data/fish";
import { rods } from "@/data/rods";
import { baits } from "@/data/baits";
import { potions } from "@/data/potions";
import { pets, eggs } from "@/data/pets";
import { events } from "@/data/events";
import { upgrades } from "@/data/upgrades";
import { sackTiers } from "@/data/sack";
import { db } from "@/db";
import { fishingProfile } from "@/db/schema";
import { redis } from "@/db/redis";
import { desc } from "drizzle-orm";
import { createUserRoutes } from "@/api/userRoutes";
import { createMarketRoutes } from "@/api/marketRoutes";
import { createEventRoutes } from "@/api/eventRoutes";

export const app = new CoreBot();

// HTTP API Server
const api = new Elysia({ prefix: "/api" })
  .use(cors())
  .get("/commands", ({ query }) => {
    const limit = Math.min(
      Math.max(parseInt(query.limit as string) || 20, 1),
      100,
    );
    const offset = Math.max(parseInt(query.offset as string) || 0, 0);
    const category = (query.category as string)?.toLowerCase();

    let commands = Array.from(app.commands.values());

    if (category) {
      commands = commands.filter(
        (cmd) => cmd.category?.toLowerCase() === category,
      );
    }

    const total = commands.length;
    const paginated = commands.slice(offset, offset + limit);

    return {
      success: true,
      data: {
        total,
        limit,
        offset,
        count: paginated.length,
        commands: paginated.map((cmd) => ({
          name: cmd.name,
          description: cmd.description,
          category: cmd.category || "uncategorized",
          usage: cmd.usage,
          adminOnly: cmd.adminOnly ?? false,
          devOnly: cmd.devOnly ?? false,
          options: cmd.options || [],
        })),
      },
    };
  })
  .get("/commands/:name", ({ params }) => {
    const cmd = app.commands.get(params.name);

    if (!cmd) {
      return {
        success: false,
        error: "Command not found",
      };
    }

    return {
      success: true,
      data: {
        name: cmd.name,
        description: cmd.description,
        category: cmd.category || "uncategorized",
        usage: cmd.usage,
        adminOnly: cmd.adminOnly ?? false,
        devOnly: cmd.devOnly ?? false,
        options: cmd.options || [],
      },
    };
  })
  .get("/health", () => ({
    success: true,
    status: "ok",
    timestamp: new Date().toISOString(),
  }))
  // ── Fish ──────────────────────────────────────────────────────────────────
  .get("/fish", ({ query }) => {
    const rarity = (query.rarity as string)?.toLowerCase();
    let data = fish;
    if (rarity) data = data.filter((f) => f.rarity === rarity);
    return { success: true, data: { total: data.length, fish: data } };
  })
  .get("/fish/:id", ({ params, set }) => {
    const item = fish.find((f) => f.id === params.id);
    if (!item) {
      set.status = 404;
      return { success: false, error: "Fish not found" };
    }
    return { success: true, data: item };
  })
  // ── Rods ──────────────────────────────────────────────────────────────────
  .get("/rods", ({ query }) => {
    const rarity = (query.rarity as string)?.toLowerCase();
    let data = rods;
    if (rarity) data = data.filter((r) => r.rarity === rarity);
    return { success: true, data: { total: data.length, rods: data } };
  })
  .get("/rods/:id", ({ params, set }) => {
    const item = rods.find((r) => r.id === params.id);
    if (!item) {
      set.status = 404;
      return { success: false, error: "Rod not found" };
    }
    return { success: true, data: item };
  })
  // ── Baits ─────────────────────────────────────────────────────────────────
  .get("/baits", ({ query }) => {
    const rarity = (query.rarity as string)?.toLowerCase();
    let data = baits;
    if (rarity) data = data.filter((b) => b.rarity === rarity);
    return { success: true, data: { total: data.length, baits: data } };
  })
  .get("/baits/:id", ({ params, set }) => {
    const item = baits.find((b) => b.id === params.id);
    if (!item) {
      set.status = 404;
      return { success: false, error: "Bait not found" };
    }
    return { success: true, data: item };
  })
  // ── Potions ───────────────────────────────────────────────────────────────
  .get("/potions", ({ query }) => {
    const rarity = (query.rarity as string)?.toLowerCase();
    let data = potions;
    if (rarity) data = data.filter((p) => p.rarity === rarity);
    return { success: true, data: { total: data.length, potions: data } };
  })
  .get("/potions/:id", ({ params, set }) => {
    const item = potions.find((p) => p.id === params.id);
    if (!item) {
      set.status = 404;
      return { success: false, error: "Potion not found" };
    }
    return { success: true, data: item };
  })
  // ── Pets ──────────────────────────────────────────────────────────────────
  .get("/pets", ({ query }) => {
    const rarity = (query.rarity as string)?.toLowerCase();
    let data = pets;
    if (rarity) data = data.filter((p) => p.rarity === rarity);
    return { success: true, data: { total: data.length, pets: data } };
  })
  .get("/pets/:id", ({ params, set }) => {
    const item = pets.find((p) => p.id === params.id);
    if (!item) {
      set.status = 404;
      return { success: false, error: "Pet not found" };
    }
    return { success: true, data: item };
  })
  // ── Eggs ──────────────────────────────────────────────────────────────────
  .get("/eggs", ({ query }) => {
    const rarity = (query.rarity as string)?.toLowerCase();
    let data = eggs;
    if (rarity) data = data.filter((e) => e.rarity === rarity);
    return { success: true, data: { total: data.length, eggs: data } };
  })
  .get("/eggs/:id", ({ params, set }) => {
    const item = eggs.find((e) => e.id === params.id);
    if (!item) {
      set.status = 404;
      return { success: false, error: "Egg not found" };
    }
    return { success: true, data: item };
  })
  // ── Events ────────────────────────────────────────────────────────────────
  .get("/events", () => ({
    success: true,
    data: { total: events.length, events },
  }))
  .get("/events/:id", ({ params, set }) => {
    const item = events.find((e) => e.id === params.id);
    if (!item) {
      set.status = 404;
      return { success: false, error: "Event not found" };
    }
    return { success: true, data: item };
  })
  // ── Upgrades ──────────────────────────────────────────────────────────────
  .get("/upgrades", () => {
    const serialized = upgrades.map((u) => ({
      id: u.id,
      name: u.name,
      emoji: u.emoji,
      description: u.description,
      maxTier: u.maxTier,
      requires: u.requires ?? null,
      prices: Array.from({ length: u.maxTier }, (_, i) =>
        typeof u.price === "function" ? u.price(i) : u.price,
      ),
    }));

    return {
      success: true,
      data: {
        upgrades: serialized,
        sackTiers,
      },
    };
  })
  // ── Leaderboard ───────────────────────────────────────────────────────────
  .get("/leaderboard/:type", async ({ params, set }) => {
    const type = params.type;
    const validTypes = ["coins", "level", "catches"] as const;

    if (!validTypes.includes(type as (typeof validTypes)[number])) {
      set.status = 400;
      return {
        success: false,
        error: "Invalid type. Use: coins, level, catches",
      };
    }

    const cacheKey = `api:leaderboard:${type}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return {
        success: true,
        cached: true,
        data: JSON.parse(cached as string),
      };
    }

    const orderCol =
      type === "coins"
        ? desc(fishingProfile.coins)
        : type === "level"
          ? desc(fishingProfile.level)
          : desc(fishingProfile.totalCatches);

    const rows = await db
      .select()
      .from(fishingProfile)
      .orderBy(orderCol, desc(fishingProfile.xp))
      .limit(10);

    const entries = await Promise.all(
      rows.map(async (row, i) => {
        const base = {
          rank: i + 1,
          coins: row.coins,
          level: row.level,
          xp: row.xp,
          totalCatches: row.totalCatches,
        };

        if (row.leaderboardHidden) {
          return {
            ...base,
            anonymous: true,
            username: null,
            avatar: null,
            userId: null,
          };
        }

        let username = "Unknown";
        let avatar: string | null = null;
        try {
          const user = await app.users.fetch(row.userId);
          username = user.username;
          avatar = user.displayAvatarURL({ size: 128 });
        } catch {}

        return {
          ...base,
          anonymous: false,
          userId: row.userId,
          username,
          avatar,
        };
      }),
    );

    const payload = { type, entries };
    await redis.set(cacheKey, JSON.stringify(payload));
    await redis.send("EXPIRE", [cacheKey, "120"]);

    return { success: true, cached: false, data: payload };
  })
  // ── Servers ───────────────────────────────────────────────────────────────
  .get("/servers", () => {
    const servers = app.guilds.cache
      .sort((a, b) => b.memberCount - a.memberCount)
      .first(10)
      .map((guild) => ({
        id: guild.id,
        name: guild.name,
        memberCount: guild.memberCount,
        icon: guild.iconURL({ size: 256 }),
      }));

    return { success: true, data: { total: servers.length, servers } };
  })
  // ── Index ─────────────────────────────────────────────────────────────────
  .get("/", () => ({
    success: true,
    name: "Baitin API",
    version: "1.0.0",
    endpoints: [
      "GET /api/",
      "GET /api/health",
      "GET /api/commands",
      "GET /api/commands/:name",
      "GET /api/fish",
      "GET /api/fish/:id",
      "GET /api/rods",
      "GET /api/rods/:id",
      "GET /api/baits",
      "GET /api/baits/:id",
      "GET /api/potions",
      "GET /api/potions/:id",
      "GET /api/pets",
      "GET /api/pets/:id",
      "GET /api/eggs",
      "GET /api/eggs/:id",
      "GET /api/events",
      "GET /api/events/:id",
      "GET /api/upgrades",
      "GET /api/leaderboard/:type",
      "GET /api/servers",
      // Authenticated user endpoints
      "GET /api/user/:discordId",
      "GET /api/user/:discordId/hut",
      "POST /api/user/:discordId/hut/upgrade",
      "GET /api/user/:discordId/hut/notifications",
      "POST /api/user/:discordId/hut/notifications/:id/read",
      "GET /api/user/:discordId/achievements",
      "GET /api/user/:discordId/sack",
      "POST /api/user/:discordId/sack/sell",
      "GET /api/user/:discordId/equipment",
      "POST /api/user/:discordId/equipment/upgrade",
      "GET /api/user/:discordId/potions",
      "POST /api/user/:discordId/potions/:itemId/activate",
      "GET /api/user/:discordId/settings",
      "PATCH /api/user/:discordId/settings",
      // Market endpoints (auth required)
      "GET /api/market",
      "POST /api/market/list",
      "POST /api/market/:listingId/buy",
      "POST /api/market/:listingId/bid",
      "DELETE /api/market/:listingId",
      // Active events (auth required)
      "GET /api/events/active",
      "POST /api/events/:eventId/join",
    ],
    filters: "All list endpoints support ?rarity= query param",
    auth: "Authenticated endpoints require: Authorization: Bearer <JWT>",
  }))

process.on("unhandledRejection", (reason) => {
  err(`Unhandled rejection: ${reason}`, 0);
});

app.init();

api
  .use(createUserRoutes(app))
  .use(createMarketRoutes(app))
  .use(createEventRoutes(app))
  .listen(3000, () => {
    info(`HTTP API running on http://localhost:3000/api`);
  });
