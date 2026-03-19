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
    if (!item) { set.status = 404; return { success: false, error: "Fish not found" }; }
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
    if (!item) { set.status = 404; return { success: false, error: "Rod not found" }; }
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
    if (!item) { set.status = 404; return { success: false, error: "Bait not found" }; }
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
    if (!item) { set.status = 404; return { success: false, error: "Potion not found" }; }
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
    if (!item) { set.status = 404; return { success: false, error: "Pet not found" }; }
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
    if (!item) { set.status = 404; return { success: false, error: "Egg not found" }; }
    return { success: true, data: item };
  })
  // ── Events ────────────────────────────────────────────────────────────────
  .get("/events", () => ({
    success: true,
    data: { total: events.length, events },
  }))
  .get("/events/:id", ({ params, set }) => {
    const item = events.find((e) => e.id === params.id);
    if (!item) { set.status = 404; return { success: false, error: "Event not found" }; }
    return { success: true, data: item };
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
    ],
    filters: "All list endpoints support ?rarity= query param",
  }));

process.on("unhandledRejection", (reason) => {
  err(`Unhandled rejection: ${reason}`, 0);
});

app.init();

api.listen(3000, () => {
  info(`HTTP API running on http://localhost:3000/api`);
});
