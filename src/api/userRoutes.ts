import Elysia from "elysia";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { redis } from "@/db/redis";
import { fishingProfile, hutNotifications, hut, achievement as achievementTable } from "@/db/schema";
import { removeItem } from "@/modules/fishing/inventory";
import { allItems, rodItems, potionItems, hutSpeedUpgrades, hutLuckUpgrades, hutInventoryUpgrades } from "@/data";
import { achievementDefs, achievementMap } from "@/data/achievements";
import { getOrCreateProfile, addCoins, subtractCoins } from "@/modules/fishing/economy";
import { getInventory, sellItem, addItem } from "@/modules/fishing/inventory";
import { getHut, upgradeHut, getHutNotifications } from "@/modules/fishing/hut";
import { getActiveBuffs, addBuff } from "@/modules/fishing/buffs";
import { getUnlockedAchievements } from "@/modules/fishing/achievements";
import { xpForNextLevel } from "@/utils/leveling";
import { requireAuthForUser } from "./auth";
import config from "@/config";
import type { Client } from "discord.js";

// ── Achievement progress map ───────────────────────────────────────────────

type ProfileSnap = Awaited<ReturnType<typeof getOrCreateProfile>>;

const ACHIEVEMENT_PROGRESS: Partial<
  Record<string, (p: ProfileSnap) => { progress: number; goal: number }>
> = {
  first_catch:   (p) => ({ progress: Math.min(p.totalCatches, 1),    goal: 1 }),
  catches_10:    (p) => ({ progress: Math.min(p.totalCatches, 10),   goal: 10 }),
  catches_100:   (p) => ({ progress: Math.min(p.totalCatches, 100),  goal: 100 }),
  catches_500:   (p) => ({ progress: Math.min(p.totalCatches, 500),  goal: 500 }),
  catches_1000:  (p) => ({ progress: Math.min(p.totalCatches, 1000), goal: 1000 }),
  streak_3:      (p) => ({ progress: Math.min(p.currentStreak, 3),   goal: 3 }),
  streak_7:      (p) => ({ progress: Math.min(p.currentStreak, 7),   goal: 7 }),
  streak_30:     (p) => ({ progress: Math.min(p.currentStreak, 30),  goal: 30 }),
  earn_1000:     (p) => ({ progress: Math.min(p.coins, 1000),        goal: 1000 }),
  earn_10000:    (p) => ({ progress: Math.min(p.coins, 10000),       goal: 10000 }),
};

// ── Route factory ──────────────────────────────────────────────────────────

export function createUserRoutes(_client: Client) {
  return new Elysia({ prefix: "/user" })

    // ── GET /user/:discordId ───────────────────────────────────────────────
    .get("/:discordId", async ({ params, headers, set }) => {
      const auth = requireAuthForUser(headers.authorization, params.discordId, set);
      if (!auth.ok) return auth;

      const profile = await getOrCreateProfile(params.discordId);
      return {
        success: true,
        data: {
          level: profile.level,
          xp: profile.xp,
          xpToNextLevel: xpForNextLevel(profile.level),
          coins: profile.coins,
          gems: profile.gems,
          reputation: profile.reputation,
          totalCatches: profile.totalCatches,
          joinedAt: profile.createdAt?.toISOString() ?? null,
        },
      };
    })

    // ── GET /user/:discordId/hut ───────────────────────────────────────────
    .get("/:discordId/hut", async ({ params, headers, set }) => {
      const auth = requireAuthForUser(headers.authorization, params.discordId, set);
      if (!auth.ok) return auth;

      const hutData = await getHut(params.discordId);
      if (!hutData) {
        set.status = 404;
        return { success: false, error: "No hut found" };
      }

      const speedUpgrade = hutSpeedUpgrades.find((u) => u.level === hutData.speedLevel);
      const catchesPerHour = Math.round(60 / (speedUpgrade?.speedMinutes ?? 60));
      const income = Math.round(catchesPerHour * 150 * config.fishing.sellPriceMultiplier);

      const upgradeAvailable =
        hutData.speedLevel < 5 ||
        hutData.luckLevel < 5 ||
        hutData.inventoryLevel < (hutInventoryUpgrades.at(-1)?.level ?? 4);

      return {
        success: true,
        data: {
          name: "Fishing Hut",
          level: hutData.level,
          speedLevel: hutData.speedLevel,
          luckLevel: hutData.luckLevel,
          inventoryLevel: hutData.inventoryLevel,
          income,
          upgradeAvailable,
        },
      };
    })

    // ── POST /user/:discordId/hut/upgrade ─────────────────────────────────
    .post("/:discordId/hut/upgrade", async ({ params, headers, body, set }) => {
      const auth = requireAuthForUser(headers.authorization, params.discordId, set);
      if (!auth.ok) return auth;

      const { type } = body as { type?: string };
      if (type !== "speed" && type !== "luck" && type !== "inventory") {
        set.status = 400;
        return { success: false, error: "body.type must be 'speed', 'luck', or 'inventory'" };
      }

      const hutData = await getHut(params.discordId);
      if (!hutData) {
        set.status = 404;
        return { success: false, error: "No hut found" };
      }

      const upgradeList =
        type === "speed" ? hutSpeedUpgrades :
        type === "luck"  ? hutLuckUpgrades  :
        hutInventoryUpgrades;

      const currentLevel =
        type === "speed" ? hutData.speedLevel :
        type === "luck"  ? hutData.luckLevel  :
        hutData.inventoryLevel;

      const next = upgradeList.find((u) => u.level === currentLevel + 1);
      if (!next) {
        set.status = 400;
        return { success: false, error: "Already at max level" };
      }

      const result = await upgradeHut(params.discordId, type);
      if (!result.success) {
        set.status = 400;
        return { success: false, error: result.error };
      }

      return { success: true, data: { newLevel: result.newLevel, costPaid: next.cost } };
    })

    // ── GET /user/:discordId/hut/notifications ────────────────────────────
    .get("/:discordId/hut/notifications", async ({ params, headers, set }) => {
      const auth = requireAuthForUser(headers.authorization, params.discordId, set);
      if (!auth.ok) return auth;

      const notifications = await getHutNotifications(params.discordId);
      return {
        success: true,
        data: notifications.map((n) => ({
          id: n.id,
          type: "hut_catch",
          message: n.message,
          createdAt: n.createdAt?.toISOString() ?? null,
          read: n.read,
        })),
      };
    })

    // ── POST /user/:discordId/hut/notifications/:id/read ──────────────────
    .post("/:discordId/hut/notifications/:id/read", async ({ params, headers, set }) => {
      const auth = requireAuthForUser(headers.authorization, params.discordId, set);
      if (!auth.ok) return auth;

      const result = await db
        .update(hutNotifications)
        .set({ read: true })
        .where(
          and(
            eq(hutNotifications.id, params.id),
            eq(hutNotifications.userId, params.discordId),
          ),
        )
        .returning({ id: hutNotifications.id });

      if (result.length === 0) {
        set.status = 404;
        return { success: false, error: "Notification not found" };
      }

      return { success: true };
    })

    // ── GET /user/:discordId/achievements ─────────────────────────────────
    .get("/:discordId/achievements", async ({ params, headers, set }) => {
      const auth = requireAuthForUser(headers.authorization, params.discordId, set);
      if (!auth.ok) return auth;

      const [unlockedRows, profile] = await Promise.all([
        getUnlockedAchievements(params.discordId),
        getOrCreateProfile(params.discordId),
      ]);

      const rows = await db
        .select()
        .from(achievementTable)
        .where(eq(achievementTable.userId, params.discordId));

      const unlockedWithDate = new Map(rows.map((r) => [r.achievementId, r.unlockedAt]));
      const unlockedSet = new Set(unlockedRows);

      const result = achievementDefs.map((def) => {
        const pg = ACHIEVEMENT_PROGRESS[def.id]?.(profile) ?? null;
        return {
          id: def.id,
          name: def.name,
          description: def.description,
          emoji: def.emoji,
          category: def.category,
          coinReward: def.coinReward,
          xpReward: def.xpReward,
          unlockedAt: unlockedWithDate.get(def.id)?.toISOString() ?? null,
          progress: unlockedSet.has(def.id) ? pg?.goal ?? null : (pg?.progress ?? null),
          goal: pg?.goal ?? null,
        };
      });

      return { success: true, data: result };
    })

    // ── GET /user/:discordId/sack ──────────────────────────────────────────
    .get("/:discordId/sack", async ({ params, headers, set }) => {
      const auth = requireAuthForUser(headers.authorization, params.discordId, set);
      if (!auth.ok) return auth;

      const inventory = await getInventory(params.discordId);
      const items = inventory.map((row) => {
        const item = allItems.get(row.itemId);
        return {
          itemId: row.itemId,
          itemType: row.itemType,
          name: item?.name ?? row.itemId,
          emoji: item?.emoji ?? "❓",
          rarity: (item as any)?.rarity ?? "common",
          quantity: row.quantity,
          sellPrice: item
            ? Math.floor(item.price * config.fishing.sellPriceMultiplier)
            : 0,
        };
      });

      return { success: true, data: items };
    })

    // ── POST /user/:discordId/sack/sell ────────────────────────────────────
    .post("/:discordId/sack/sell", async ({ params, headers, body, set }) => {
      const auth = requireAuthForUser(headers.authorization, params.discordId, set);
      if (!auth.ok) return auth;

      const { items } = body as { items?: { itemId: string; quantity: number }[] };
      if (!Array.isArray(items) || items.length === 0) {
        set.status = 400;
        return { success: false, error: "body.items must be a non-empty array" };
      }

      let coinsEarned = 0;
      const errors: string[] = [];

      for (const { itemId, quantity } of items) {
        if (!itemId || typeof quantity !== "number" || quantity < 1) {
          errors.push(`Invalid entry: ${itemId}`);
          continue;
        }
        const result = await sellItem(params.discordId, itemId, quantity);
        if (result.success) {
          coinsEarned += result.coinsGained ?? 0;
        } else {
          errors.push(result.error ?? itemId);
        }
      }

      return { success: true, data: { coinsEarned, errors } };
    })

    // ── GET /user/:discordId/equipment ────────────────────────────────────
    .get("/:discordId/equipment", async ({ params, headers, set }) => {
      const auth = requireAuthForUser(headers.authorization, params.discordId, set);
      if (!auth.ok) return auth;

      const profile = await getOrCreateProfile(params.discordId);
      const rod = profile.equippedRodId ? rodItems.get(profile.equippedRodId) : null;

      let baitItem: { id: string; name: string; emoji: string; rarity: string; quantity: number } | null = null;
      if (profile.equippedBaitId) {
        const baitDef = allItems.get(profile.equippedBaitId);
        if (baitDef) {
          const inv = await getInventory(params.discordId);
          const qty = inv.find((r) => r.itemId === profile.equippedBaitId)?.quantity ?? 0;
          baitItem = {
            id: baitDef.id,
            name: baitDef.name,
            emoji: baitDef.emoji,
            rarity: (baitDef as any).rarity,
            quantity: qty,
          };
        }
      }

      return {
        success: true,
        data: {
          rod: rod
            ? {
                id: rod.id,
                name: rod.name,
                emoji: rod.emoji,
                rarity: rod.rarity,
                luckBonus: rod.luckBonus,
                speedReduction: rod.speedReduction,
                durability: profile.equippedRodDurability ?? rod.durability,
                buyPrice: rod.buyPrice,
              }
            : null,
          bait: baitItem,
        },
      };
    })

    // ── POST /user/:discordId/equipment/upgrade ────────────────────────────
    .post("/:discordId/equipment/upgrade", async ({ params, headers, body, set }) => {
      const auth = requireAuthForUser(headers.authorization, params.discordId, set);
      if (!auth.ok) return auth;

      const { rodId } = body as { rodId?: string };
      if (!rodId) {
        set.status = 400;
        return { success: false, error: "body.rodId is required" };
      }

      const rod = rodItems.get(rodId);
      if (!rod) {
        set.status = 404;
        return { success: false, error: "Rod not found" };
      }
      if (rod.buyPrice === 0) {
        set.status = 400;
        return { success: false, error: "This rod cannot be purchased" };
      }

      const paid = await subtractCoins(params.discordId, rod.buyPrice);
      if (!paid) {
        set.status = 400;
        return { success: false, error: "Not enough coins" };
      }

      const durability = rod.durability > 0 ? rod.durability : null;
      await db
        .update(fishingProfile)
        .set({ equippedRodId: rod.id, equippedRodDurability: durability })
        .where(eq(fishingProfile.userId, params.discordId));

      return {
        success: true,
        data: {
          newRod: {
            id: rod.id,
            name: rod.name,
            emoji: rod.emoji,
            rarity: rod.rarity,
            luckBonus: rod.luckBonus,
            speedReduction: rod.speedReduction,
            durability: rod.durability,
          },
          costPaid: rod.buyPrice,
        },
      };
    })

    // ── GET /user/:discordId/rods ──────────────────────────────────────────
    .get("/:discordId/rods", async ({ params, headers, set }) => {
      const auth = requireAuthForUser(headers.authorization, params.discordId, set);
      if (!auth.ok) return auth;

      const [profile, inventory] = await Promise.all([
        getOrCreateProfile(params.discordId),
        getInventory(params.discordId),
      ]);

      const ownedRods = inventory
        .filter((row) => row.itemType === "rod")
        .map((row) => {
          const rod = rodItems.get(row.itemId);
          if (!rod) return null;
          return {
            id: rod.id,
            name: rod.name,
            emoji: rod.emoji,
            rarity: rod.rarity,
            luckBonus: rod.luckBonus,
            speedReduction: rod.speedReduction,
            durability: rod.durability,
            buyPrice: rod.buyPrice,
            equipped: profile.equippedRodId === rod.id,
          };
        })
        .filter(Boolean);

      return { success: true, data: { rods: ownedRods } };
    })

    // ── POST /user/:discordId/equipment/equip ──────────────────────────────
    .post("/:discordId/equipment/equip", async ({ params, headers, body, set }) => {
      const auth = requireAuthForUser(headers.authorization, params.discordId, set);
      if (!auth.ok) return auth;

      const { rodId } = body as { rodId?: string };
      if (!rodId) {
        set.status = 400;
        return { success: false, error: "body.rodId is required" };
      }

      const rod = rodItems.get(rodId);
      if (!rod) {
        set.status = 404;
        return { success: false, error: "Rod not found" };
      }

      // Verify the user owns this rod (in inventory) or it's the starter rod
      const inventory = await getInventory(params.discordId);
      const owned = rod.buyPrice === 0 || inventory.some((r) => r.itemId === rodId && r.itemType === "rod");
      if (!owned) {
        set.status = 403;
        return { success: false, error: "You don't own this rod" };
      }

      const durability = rod.durability > 0 ? rod.durability : null;
      await db
        .update(fishingProfile)
        .set({ equippedRodId: rod.id, equippedRodDurability: durability })
        .where(eq(fishingProfile.userId, params.discordId));

      return { success: true, data: { rodId: rod.id } };
    })

    // ── GET /user/:discordId/potions ───────────────────────────────────────
    .get("/:discordId/potions", async ({ params, headers, set }) => {
      const auth = requireAuthForUser(headers.authorization, params.discordId, set);
      if (!auth.ok) return auth;

      const [inventory, activeBuffs] = await Promise.all([
        getInventory(params.discordId),
        getActiveBuffs(params.discordId),
      ]);

      const potionRows = inventory.filter((r) => r.itemType === "misc" && potionItems.has(r.itemId));

      const result = potionRows.map((row) => {
        const def = potionItems.get(row.itemId)!;

        // Find the latest activeUntil across all matching buff types
        const activeUntil = def.effects.reduce<number | null>((best, effect) => {
          const match = activeBuffs
            .filter((b) => b.type === effect.type)
            .map((b) => b.expiresAt);
          const maxExpiry = match.length > 0 ? Math.max(...match) : null;
          if (maxExpiry === null) return best;
          return best === null ? maxExpiry : Math.max(best, maxExpiry);
        }, null);

        return {
          itemId: def.id,
          name: def.name,
          emoji: def.emoji,
          rarity: def.rarity,
          quantity: row.quantity,
          effects: def.effects,
          activeUntil,
        };
      });

      return { success: true, data: result };
    })

    // ── POST /user/:discordId/potions/:itemId/activate ────────────────────
    .post("/:discordId/potions/:itemId/activate", async ({ params, headers, set }) => {
      const auth = requireAuthForUser(headers.authorization, params.discordId, set);
      if (!auth.ok) return auth;

      const def = potionItems.get(params.itemId);
      if (!def) {
        set.status = 404;
        return { success: false, error: "Potion not found" };
      }

      const removed = await removeItem(params.discordId, params.itemId, 1);
      if (!removed) {
        set.status = 400;
        return { success: false, error: "Potion not in inventory" };
      }

      await addBuff(params.discordId, def.effects);

      const maxDuration = Math.max(...def.effects.map((e) => e.durationMinutes));
      const activeUntil = Date.now() + maxDuration * 60 * 1000;

      return { success: true, data: { activeUntil } };
    })

    // ── GET /user/:discordId/settings ─────────────────────────────────────
    .get("/:discordId/settings", async ({ params, headers, set }) => {
      const auth = requireAuthForUser(headers.authorization, params.discordId, set);
      if (!auth.ok) return auth;

      const profile = await getOrCreateProfile(params.discordId);
      return {
        success: true,
        data: {
          dmNotifications: profile.hutNotifications,
          catchAlerts: profile.catchAlerts,
          marketAlerts: profile.marketAlerts,
          language: profile.language,
        },
      };
    })

    // ── PATCH /user/:discordId/settings ───────────────────────────────────
    .patch("/:discordId/settings", async ({ params, headers, body, set }) => {
      const auth = requireAuthForUser(headers.authorization, params.discordId, set);
      if (!auth.ok) return auth;

      const patch = body as Partial<{
        dmNotifications: boolean;
        catchAlerts: boolean;
        marketAlerts: boolean;
        language: string;
      }>;

      const updates: Record<string, unknown> = {};
      if (typeof patch.dmNotifications === "boolean") updates.hutNotifications = patch.dmNotifications;
      if (typeof patch.catchAlerts === "boolean") updates.catchAlerts = patch.catchAlerts;
      if (typeof patch.marketAlerts === "boolean") updates.marketAlerts = patch.marketAlerts;
      if (typeof patch.language === "string" && patch.language.length <= 10)
        updates.language = patch.language;

      if (Object.keys(updates).length === 0) {
        set.status = 400;
        return { success: false, error: "No valid fields provided" };
      }

      const [updated] = await db
        .update(fishingProfile)
        .set(updates)
        .where(eq(fishingProfile.userId, params.discordId))
        .returning({
          hutNotifications: fishingProfile.hutNotifications,
          catchAlerts: fishingProfile.catchAlerts,
          marketAlerts: fishingProfile.marketAlerts,
          language: fishingProfile.language,
        });

      return {
        success: true,
        data: {
          dmNotifications: updated.hutNotifications,
          catchAlerts: updated.catchAlerts,
          marketAlerts: updated.marketAlerts,
          language: updated.language,
        },
      };
    });
}
