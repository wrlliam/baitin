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
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";

// ─── Hut view helpers ─────────────────────────────────────────────────────────

function buildHutActionRows(userId: string) {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`hut:collect:${userId}`)
      .setLabel(`${config.emojis.collect} Collect`)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`hut:inventory:${userId}`)
      .setLabel(`${config.emojis.inventory} Inventory`)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`hut:configure:${userId}`)
      .setLabel(`${config.emojis.configure} Configure`)
      .setStyle(ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`hut:upgrade:speed:${userId}`)
      .setLabel(`${config.emojis.up_arrow} Speed`)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`hut:upgrade:luck:${userId}`)
      .setLabel(`${config.emojis.up_arrow} Luck`)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`hut:upgrade:inv:${userId}`)
      .setLabel(`${config.emojis.up_arrow} Inv`)
      .setStyle(ButtonStyle.Secondary),
  );
  return [row1, row2] as const;
}

async function buildHutMainPayload(userId: string) {
  const hutData = await getHut(userId);
  if (!hutData) return null;

  const speedUpgrade = hutSpeedUpgrades.find((u) => u.level === hutData.speedLevel);
  const invUpgrade = hutInventoryUpgrades.find((u) => u.level === hutData.inventoryLevel);
  const rod = hutData.rodId ? rodItems.get(hutData.rodId) : null;
  const hutInv = await getHutInventory(userId);
  const nextCollect = hutData.lastCollectedAt
    ? new Date(
        hutData.lastCollectedAt.getTime() +
          (speedUpgrade?.speedMinutes ?? 60) * 60 * 1000,
      )
    : new Date();
  const durabilityDisplay = rod
    ? `${rod.emoji} ${rod.name} (${hutData.rodDurability ?? "∞"} uses left)`
    : "None";

  const embedPayload = ui()
    .color(config.colors.default)
    .title(`${config.emojis.hut} Your Hut`)
    .body(
      `**Speed Level:** ${hutData.speedLevel} (${speedUpgrade?.speedMinutes ?? 60} min/catch)\n**Luck Level:** ${hutData.luckLevel}\n**Inventory:** ${hutInv.length} items / ${invUpgrade?.capacity ?? 12}`,
    )
    .divider()
    .body(
      `**Equipped Rod:** ${durabilityDisplay}\n**Next Catch (approx):** <t:${Math.floor(nextCollect.getTime() / 1000)}:R>`,
    )
    .build();

  const [row1, row2] = buildHutActionRows(userId);
  return {
    
    components: [...embedPayload.components, row1, row2],
  };
}

async function buildHutInventoryPayload(userId: string) {
  const hutInv = await getHutInventory(userId);
  const invBuilder = ui().color(config.colors.default).title(`${config.emojis.inventory} Hut Inventory`);

  if (hutInv.length === 0) {
    invBuilder.text("Your hut inventory is empty. Wait for it to catch some fish!");
  } else {
    for (const inv of hutInv) {
      const item = allItems.get(inv.itemId);
      if (!item) continue;
      const sellPrice = Math.floor(item.price * config.fishing.sellPriceMultiplier);
      invBuilder.section(
        `${item.emoji} **${item.name}** ×${inv.quantity}\n-# ${sellPrice} ${config.emojis.coin} each`,
        new ButtonBuilder()
          .setCustomId(`hut:sellitem:${inv.itemId}:${userId}`)
          .setLabel("Sell")
          .setStyle(ButtonStyle.Danger),
      );
    }
  }

  const actionBtns: ButtonBuilder[] = [];
  if (hutInv.length > 0) {
    actionBtns.push(
      new ButtonBuilder()
        .setCustomId(`hut:sellall:${userId}`)
        .setLabel(`${config.emojis.sell} Sell All`)
        .setStyle(ButtonStyle.Danger),
    );
  }
  actionBtns.push(
    new ButtonBuilder()
      .setCustomId(`hut:back:${userId}`)
      .setLabel("◄ Back")
      .setStyle(ButtonStyle.Secondary),
  );

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(...actionBtns);
  return {
    
    components: [...invBuilder.build().components, actionRow],
  };
}

// ──────────────────────────────────────────────────────────────────────────────

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
              .title(`${config.emojis.hut} Fishing Hut`)
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
            .title(`${config.emojis.hut} Your Hut`)
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

      const mainPayload = await buildHutMainPayload(ctx.user.id);
      if (!mainPayload) {
        return ctx.editReply({ content: `${config.emojis.cross} Failed to load hut data.` });
      }

      const message = await ctx.editReply(mainPayload as any);

      const collector = message.createMessageComponentCollector({
        filter: (i) => i.user.id === ctx.user.id,
        time: 5 * 60_000,
      });

      collector.on("collect", async (interaction) => {
        const id = interaction.customId;

        // ── Collect ──────────────────────────────────────────────────────────
        if (id === `hut:collect:${ctx.user.id}`) {
          const result = await collectHut(ctx.user.id);
          let collectBody: string;
          if (!result || result.items.length === 0) {
            collectBody = "Nothing to collect yet. Check back later!";
          } else {
            const lines = result.items.map((it) => `${it.emoji} **${it.name}** ×${it.quantity}`);
            collectBody = `Collected **${result.total}** catches:\n${lines.join("\n")}`;
          }

          const collectEmbed = ui()
            .color(config.colors.default)
            .title(`${config.emojis.hut} Hut Collected!`)
            .text(collectBody)
            .build();
          const [r1, r2] = buildHutActionRows(ctx.user.id);
          await interaction.update({
            
            components: [...collectEmbed.components, r1, r2],
          } as any);
          return;
        }

        // ── Inventory ─────────────────────────────────────────────────────────
        if (id === `hut:inventory:${ctx.user.id}`) {
          await interaction.update((await buildHutInventoryPayload(ctx.user.id)) as any);
          return;
        }

        // ── Sell individual item ──────────────────────────────────────────────
        if (id.startsWith("hut:sellitem:")) {
          const parts = id.split(":");
          const itemId = parts[2];
          const result = await sellHutItems(ctx.user.id, itemId);
          if (!result.success) {
            await interaction.reply({
              flags: MessageFlags.Ephemeral,
              content: `${config.emojis.cross} ${result.error}`,
            });
            return;
          }
          await interaction.update((await buildHutInventoryPayload(ctx.user.id)) as any);
          return;
        }

        // ── Sell all ─────────────────────────────────────────────────────────
        if (id === `hut:sellall:${ctx.user.id}`) {
          const result = await sellHutItems(ctx.user.id);
          if (!result.success) {
            await interaction.reply({
              flags: MessageFlags.Ephemeral,
              content: `${config.emojis.cross} ${result.error}`,
            });
            return;
          }
          await interaction.update((await buildHutInventoryPayload(ctx.user.id)) as any);
          return;
        }

        // ── Back to main view ─────────────────────────────────────────────────
        if (id === `hut:back:${ctx.user.id}`) {
          const payload = await buildHutMainPayload(ctx.user.id);
          if (payload) await interaction.update(payload as any);
          return;
        }

        // ── Upgrade ───────────────────────────────────────────────────────────
        if (id.startsWith("hut:upgrade:")) {
          const parts = id.split(":");
          const upgradeType = parts[2] as "speed" | "luck" | "inventory" | "inv";
          const type = upgradeType === "inv" ? "inventory" : upgradeType;
          const result = await upgradeHut(ctx.user.id, type);
          if (!result.success) {
            await interaction.reply({
              flags: MessageFlags.Ephemeral,
              content: `${config.emojis.cross} ${result.error}`,
            });
            return;
          }
          const upgradeEmbed = ui()
            .color(config.colors.default)
            .title(`${config.emojis.tick} Hut Upgraded!`)
            .text(`Your hut's **${type}** is now level **${result.newLevel}**.`)
            .build();
          const [r1, r2] = buildHutActionRows(ctx.user.id);
          await interaction.update({
            
            components: [...upgradeEmbed.components, r1, r2],
          } as any);
          return;
        }

        // ── Configure ─────────────────────────────────────────────────────────
        if (id === `hut:configure:${ctx.user.id}`) {
          const userInventory = await getInventory(ctx.user.id);
          const userRods = userInventory.filter((r) => r.itemType === "rod");
          const userPets = await getUserPets(ctx.user.id);

          const configEmbed = ui()
            .color(config.colors.default)
            .title(`${config.emojis.configure} Configure Hut`)
            .text("Select a rod or pet to assign to your hut.")
            .build();

          const components: any[] = [...configEmbed.components];

          if (userRods.length > 0) {
            const rodSelect = new StringSelectMenuBuilder()
              .setCustomId(`hut:setrod:${ctx.user.id}`)
              .setPlaceholder("Select a rod for your hut")
              .addOptions(
                userRods.slice(0, 25).map((r) => {
                  const rod = rodItems.get(r.itemId);
                  return new StringSelectMenuOptionBuilder()
                    .setLabel(rod ? `${rod.emoji} ${rod.name}` : r.itemId)
                    .setValue(r.itemId);
                }),
              );
            components.push(new ActionRowBuilder().addComponents(rodSelect));
          }

          if (userPets.length > 0) {
            const petSelect = new StringSelectMenuBuilder()
              .setCustomId(`hut:setpet:${ctx.user.id}`)
              .setPlaceholder("Select a pet for your hut")
              .addOptions(
                userPets.slice(0, 25).map((p) => {
                  const pet = petItems.get(p.petId);
                  const label = pet ? `${pet.emoji} ${p.name ?? pet.name} (Lv ${p.petLevel})` : p.id;
                  return new StringSelectMenuOptionBuilder()
                    .setLabel(label)
                    .setValue(p.id);
                }),
              );
            components.push(new ActionRowBuilder().addComponents(petSelect));
          }

          components.push(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId(`hut:back:${ctx.user.id}`)
                .setLabel("◄ Back")
                .setStyle(ButtonStyle.Secondary),
            ),
          );

          await interaction.update({
            
            components,
          } as any);
          return;
        }

        // ── Set rod (string select) ───────────────────────────────────────────
        if (id === `hut:setrod:${ctx.user.id}` && interaction.isStringSelectMenu()) {
          const rodId = interaction.values[0];
          const result = await setHutRod(ctx.user.id, rodId);
          if (!result.success) {
            await interaction.reply({
              flags: MessageFlags.Ephemeral,
              content: `${config.emojis.cross} ${result.error}`,
            });
            return;
          }
          const rod = rodItems.get(rodId);
          const confirmEmbed = ui()
            .color(config.colors.default)
            .title(`${config.emojis.tick} Rod Equipped`)
            .text(`Equipped **${rod?.emoji ?? ""} ${rod?.name ?? rodId}** to your hut.`)
            .build();
          const [r1, r2] = buildHutActionRows(ctx.user.id);
          await interaction.update({
            
            components: [...confirmEmbed.components, r1, r2],
          } as any);
          return;
        }

        // ── Set pet (string select) ───────────────────────────────────────────
        if (id === `hut:setpet:${ctx.user.id}` && interaction.isStringSelectMenu()) {
          const petInstanceId = interaction.values[0];
          const result = await setHutPet(ctx.user.id, petInstanceId);
          if (!result.success) {
            await interaction.reply({
              flags: MessageFlags.Ephemeral,
              content: `${config.emojis.cross} ${result.error}`,
            });
            return;
          }
          const instances = await db
            .select()
            .from(petInstance)
            .where(eq(petInstance.id, petInstanceId));
          const pet = instances[0] ? petItems.get(instances[0].petId) : null;
          const confirmEmbed = ui()
            .color(config.colors.default)
            .title(`${config.emojis.tick} Pet Assigned`)
            .text(`Assigned **${pet?.emoji ?? ""} ${pet?.name ?? petInstanceId}** to your hut.`)
            .build();
          const [r1, r2] = buildHutActionRows(ctx.user.id);
          await interaction.update({
            
            components: [...confirmEmbed.components, r1, r2],
          } as any);
          return;
        }
      });

      collector.on("end", async () => {
        try {
          await message.edit({ components: [] });
        } catch {}
      });

      return;
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
          .title(`${config.emojis.hut} Hut Collected!`)
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
          .title(`${config.emojis.hut} Hut Notifications`)
          .body(lines.join("\n"))
          .footer(`${unread.length} unread • Marked all as read`)
          .build() as any,
      );
    }
  },
} as Command;
