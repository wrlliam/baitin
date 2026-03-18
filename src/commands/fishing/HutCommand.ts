import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import {
  rodItems,
  hutSpeedUpgrades,
  hutLuckUpgrades,
  hutInventoryUpgrades,
  allItems,
  petItems,
} from "@/data";
import { getOrCreateProfile } from "@/modules/fishing/economy";
import {
  getHut,
  createHut,
  collectHut,
  upgradeHut,
  setHutRod,
  setHutPet,
  getHutInventory,
  sellHutItems,
  getHutNotifications,
  markNotificationsRead,
} from "@/modules/fishing/hut";
import { getInventory } from "@/modules/fishing/inventory";
import { getUserPets } from "@/modules/fishing/pets";
import { db } from "@/db";
import { petInstance } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
} from "discord.js";

export default {
  name: "hut",
  description: "Manage your passive fishing hut.",
  type: ApplicationCommandType.ChatInput,
  usage: [
    "/hut view",
    "/hut collect",
    "/hut upgrade",
    "/hut rod",
    "/hut pet",
    "/hut sell",
    "/hut notifications",
  ],
  options: [
    {
      name: "view",
      description: "View your hut status.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [],
    },
    {
      name: "collect",
      description: "Manually collect items from your hut.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [],
    },
    {
      name: "upgrade",
      description: "Upgrade your hut.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "type",
          description: "What to upgrade.",
          type: ApplicationCommandOptionType.String,
          required: true,
          choices: [
            { name: "Speed", value: "speed" },
            { name: "Luck", value: "luck" },
            { name: "Inventory", value: "inventory" },
          ],
        },
      ],
    },
    {
      name: "rod",
      description: "Equip a rod from your sack to your hut.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "name",
          description: "Rod to equip.",
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true,
        },
      ],
    },
    {
      name: "pet",
      description: "Set a pet for your hut.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "name",
          description: "Pet to assign.",
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true,
        },
      ],
    },
    {
      name: "sell",
      description: "Sell items stored in your hut.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "item",
          description: "Specific item to sell (omit to sell all).",
          type: ApplicationCommandOptionType.String,
          required: false,
          autocomplete: true,
        },
      ],
    },
    {
      name: "notifications",
      description: "View stored hut notifications (if DMs were closed).",
      type: ApplicationCommandOptionType.Subcommand,
      options: [],
    },
  ],
  autocomplete: async ({ ctx }) => {
    const sub = ctx.options.getSubcommand();
    const focused = ctx.options.getFocused(true);
    const value = (focused.value as string).toLowerCase();

    if (sub === "rod") {
      const inventory = await getInventory(ctx.user.id);
      const rods = inventory.filter((i) => i.itemType === "rod");
      return ctx.respond(
        rods
          .map((i) => {
            const rod = rodItems.get(i.itemId);
            return rod
              ? { name: `${rod.emoji} ${rod.name}`, value: rod.id }
              : null;
          })
          .filter(Boolean)
          .filter((c) => c!.name.toLowerCase().includes(value))
          .slice(0, 25) as { name: string; value: string }[],
      );
    }

    if (sub === "pet") {
      const pets = await getUserPets(ctx.user.id);
      return ctx.respond(
        pets
          .map((p) => {
            const pet = petItems.get(p.petId);
            const label = pet
              ? `${pet.emoji} ${p.name ?? pet.name} (Lv ${p.petLevel})`
              : p.id;
            return { name: label, value: p.id };
          })
          .filter((c) => c.name.toLowerCase().includes(value))
          .slice(0, 25),
      );
    }

    if (sub === "sell") {
      const hutData = await getHut(ctx.user.id);
      if (!hutData) return ctx.respond([]);
      const inv = await getHutInventory(ctx.user.id);
      return ctx.respond(
        inv
          .map((i) => {
            const item = allItems.get(i.itemId);
            return item
              ? {
                  name: `${item.emoji} ${item.name} ×${i.quantity}`,
                  value: i.itemId,
                }
              : null;
          })
          .filter(Boolean)
          .filter((c) => c!.name.toLowerCase().includes(value))
          .slice(0, 25) as { name: string; value: string }[],
      );
    }

    return ctx.respond([]);
  },
  run: async ({ args, client, ctx }) => {
    await ctx.deferReply();
    const sub = args.getSubcommand();
    let hutData = await getHut(ctx.user.id);

    if (sub !== "view" && !hutData) {
      return ctx.editReply({
        content: `${config.emojis.cross} You don't have a hut yet! Use \`/hut view\` to create one.`,
      });
    }

    if (sub === "view") {
      const profile = await getOrCreateProfile(ctx.user.id);

      if (!hutData) {
        if (!profile.hutOwned) {
          return ctx.editReply(
            ui()
              .color(config.colors.default)
              .title("🏡 Fishing Hut")
              .body(
                "You need a **🏡 Fishing Hut Permit** to own a hut.\nBuy one from `/shop` → Special.\n\n⚠️ Only **10** hut permits exist in the entire economy!",
              )
              .build() as any,
          );
        }

        const createResult = await createHut(ctx.user.id);
        if (!createResult.success) {
          return ctx.editReply({
            content: `${config.emojis.cross} ${createResult.error}`,
          });
        }
        hutData = createResult.data!;
        return ctx.editReply(
          ui()
            .color(config.colors.default)
            .title("🏚️ Your Hut")
            .body(
              "Welcome to your new fishing hut! It will passively catch fish over time.\nUse `/hut upgrade` to improve it.",
            )
            .divider()
            .body(
              "**Speed Level:** 1 (60 min/catch)\n**Luck Level:** 1\n**Inventory Level:** 1 (12 cap)",
            )
            .build() as any,
        );
      }

      const speedUpgrade = hutSpeedUpgrades.find(
        (u) => u.level === hutData!.speedLevel,
      );
      const invUpgrade = hutInventoryUpgrades.find(
        (u) => u.level === hutData!.inventoryLevel,
      );
      const rod = hutData.rodId ? rodItems.get(hutData.rodId) : null;
      const hutInv = await getHutInventory(ctx.user.id);
      const nextCollect = hutData.lastCollectedAt
        ? new Date(
            hutData.lastCollectedAt.getTime() +
              (speedUpgrade?.speedMinutes ?? 60) * 60 * 1000,
          )
        : new Date();
      const durabilityDisplay = rod
        ? `${rod.emoji} ${rod.name} (${hutData.rodDurability ?? "∞"} uses left)`
        : "None";

      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title("🏚️ Your Hut")
          .body(
            `**Speed Level:** ${hutData.speedLevel} (${speedUpgrade?.speedMinutes ?? 60} min/catch)\n**Luck Level:** ${hutData.luckLevel}\n**Inventory:** ${hutInv.length} items / ${invUpgrade?.capacity ?? 12}`,
          )
          .divider()
          .body(
            `**Equipped Rod:** ${durabilityDisplay}\n**Next Catch (approx):** <t:${Math.floor(nextCollect.getTime() / 1000)}:R>`,
          )
          .build() as any,
      );
    }

    if (sub === "collect") {
      const result = await collectHut(ctx.user.id);
      if (!result || result.items.length === 0) {
        return ctx.editReply({
          content: `${config.emojis.cross} Nothing to collect yet.`,
        });
      }

      const lines = result.items.map(
        (i) => `${i.emoji} **${i.name}** ×${i.quantity}`,
      );
      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title("🏚️ Hut Collected!")
          .body(`Collected **${result.total}** catches:\n${lines.join("\n")}`)
          .build() as any,
      );
    }

    if (sub === "upgrade") {
      const type = args.getString("type", true) as
        | "speed"
        | "luck"
        | "inventory";
      const result = await upgradeHut(ctx.user.id, type);

      if (!result.success) {
        return ctx.editReply({
          content: `${config.emojis.cross} ${result.error}`,
        });
      }

      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title(`${config.emojis.tick} Hut Upgraded!`)
          .body(`Your hut's **${type}** is now level **${result.newLevel}**.`)
          .build() as any,
      );
    }

    if (sub === "rod") {
      const rodId = args.getString("name", true);
      const result = await setHutRod(ctx.user.id, rodId);
      if (!result.success) {
        return ctx.editReply({
          content: `${config.emojis.cross} ${result.error}`,
        });
      }
      const rod = rodItems.get(rodId);
      return ctx.editReply({
        content: `${config.emojis.tick} Equipped **${rod?.emoji ?? ""} ${rod?.name ?? rodId}** to your hut.`,
      });
    }

    if (sub === "pet") {
      const petInstanceId = args.getString("name", true);
      const result = await setHutPet(ctx.user.id, petInstanceId);
      if (!result.success) {
        return ctx.editReply({
          content: `${config.emojis.cross} ${result.error}`,
        });
      }
      const instances = await db
        .select()
        .from(petInstance)
        .where(eq(petInstance.id, petInstanceId));
      const pet = instances[0] ? petItems.get(instances[0].petId) : null;
      return ctx.editReply({
        content: `${config.emojis.tick} Assigned **${pet?.emoji ?? ""} ${pet?.name ?? petInstanceId}** to your hut.`,
      });
    }

    if (sub === "sell") {
      const itemId = args.getString("item") ?? undefined;
      const result = await sellHutItems(ctx.user.id, itemId);
      if (!result.success) {
        return ctx.editReply({
          content: `${config.emojis.cross} ${result.error}`,
        });
      }
      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title(`${config.emojis.tick} Hut Items Sold!`)
          .body(
            `Sold **${result.itemCount}** items for **${result.totalCoins.toLocaleString()}** ${config.emojis.coin}.`,
          )
          .build() as any,
      );
    }

    if (sub === "notifications") {
      const notifications = await getHutNotifications(ctx.user.id);
      if (notifications.length === 0) {
        return ctx.editReply({ content: "No stored hut notifications." });
      }

      const unread = notifications.filter((n) => !n.read);
      const lines = notifications.slice(0, 10).map((n) => {
        const items = JSON.parse(n.message) as {
          name: string;
          emoji: string;
          quantity: number;
        }[];
        const timestamp = n.createdAt
          ? `<t:${Math.floor(n.createdAt.getTime() / 1000)}:R>`
          : "Unknown time";
        return `${timestamp}: ${items.map((i) => `${i.emoji} ${i.name} ×${i.quantity}`).join(", ")}`;
      });

      await markNotificationsRead(ctx.user.id);

      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title("🏚️ Hut Notifications")
          .body(lines.join("\n"))
          .footer(`${unread.length} unread • Marked all as read`)
          .build() as any,
      );
    }
  },
} as Command;
