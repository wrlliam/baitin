import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { allItems } from "@/data";
import {
  getOrCreateAquarium,
  getAquariumFish,
  placeFish,
  removeFishFromAquarium,
  collectIncome,
  upgradeAquarium,
  getHourlyRate,
} from "@/modules/fishing/aquarium";
import { getInventory } from "@/modules/fishing/inventory";
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  MessageFlags,
} from "discord.js";

export default {
  name: "aquarium",
  description: "Manage your aquarium — display fish for passive income",
  type: ApplicationCommandType.ChatInput,
  usage: ["/aquarium view", "/aquarium place", "/aquarium remove", "/aquarium collect", "/aquarium visit", "/aquarium upgrade"],
  defer: true,
  options: [
    {
      name: "action",
      description: "What to do",
      type: ApplicationCommandOptionType.String,
      required: true,
      choices: [
        { name: "View", value: "view" },
        { name: "Place Fish", value: "place" },
        { name: "Remove Fish", value: "remove" },
        { name: "Collect Income", value: "collect" },
        { name: "Visit Player", value: "visit" },
        { name: "Upgrade Slots", value: "upgrade" },
      ],
    },
    {
      name: "user",
      description: "Player to visit (for visit action)",
      type: ApplicationCommandOptionType.User,
      required: false,
    },
  ],
  run: async ({ args, ctx }) => {
    const action = args.getString("action", true);

    // ── View ──
    if (action === "view" || action === "visit") {
      const target = action === "visit" ? (args.getUser("user") ?? ctx.user) : ctx.user;
      const aq = await getOrCreateAquarium(target.id);
      const fish = await getAquariumFish(aq.id);

      let totalPerHour = 0;
      const fishLines = fish.map((f, i) => {
        const item = allItems.get(f.fishId);
        if (!item) return `${i + 1}. Unknown Fish`;
        const rate = getHourlyRate(item.rarity);
        totalPerHour += rate;
        return `${i + 1}. ${item.emoji} **${item.name}** — ${rate} ${config.emojis.coin}/hr`;
      });

      const lastCollected = aq.lastCollectedAt ? aq.lastCollectedAt.getTime() : Date.now();
      const hoursSince = Math.min(24, (Date.now() - lastCollected) / 3_600_000);
      const pendingCoins = Math.floor(totalPerHour * hoursSince);

      const embed = ui()
        .color(config.colors.default)
        .title(`🐠 ${target.username}'s Aquarium`)
        .text(
          `**Fish:** ${fish.length}/${aq.maxSlots} slots\n` +
            `**Income:** ${totalPerHour} ${config.emojis.coin}/hr\n` +
            `**Pending:** ~${pendingCoins.toLocaleString()} ${config.emojis.coin} (${Math.floor(hoursSince)}h accumulated)`,
        )
        .divider()
        .text(fishLines.length > 0 ? fishLines.join("\n") : "*No fish displayed yet. Use `/aquarium place` to add fish!*")
        .footer("Fish generate passive coins based on rarity");

      return ctx.editReply(embed.build() as any);
    }

    // ── Collect ──
    if (action === "collect") {
      const result = await collectIncome(ctx.user.id);
      if (result.coins === 0) {
        return ctx.editReply(
          ui()
            .color(config.colors.default)
            .title("🐠 Aquarium")
            .text("No coins to collect yet. Fish need time to generate income!")
            .build() as any,
        );
      }

      return ctx.editReply(
        ui()
          .color(config.colors.success)
          .title("🐠 Aquarium — Collected!")
          .text(
            `Collected **${result.coins.toLocaleString()}** ${config.emojis.coin} from ${result.hours}h of passive income.`,
          )
          .build() as any,
      );
    }

    // ── Upgrade ──
    if (action === "upgrade") {
      const result = await upgradeAquarium(ctx.user.id);
      if (!result.success) {
        return ctx.editReply(
          ui()
            .color(config.colors.error)
            .title("🐠 Aquarium")
            .text(result.error!)
            .build() as any,
        );
      }

      return ctx.editReply(
        ui()
          .color(config.colors.success)
          .title("🐠 Aquarium Upgraded!")
          .text(`Your aquarium now has **${result.newMax}** slots!`)
          .build() as any,
      );
    }

    // ── Place ──
    if (action === "place") {
      const inventory = await getInventory(ctx.user.id);
      const fishInv = inventory.filter((i) => i.itemType === "fish");

      if (fishInv.length === 0) {
        return ctx.editReply(
          ui()
            .color(config.colors.error)
            .title("🐠 Aquarium")
            .text("You have no fish in your inventory to place.")
            .build() as any,
        );
      }

      const options = fishInv.slice(0, 25).map((inv) => {
        const item = allItems.get(inv.itemId);
        const label = item ? `${item.emoji} ${item.name} (×${inv.quantity})` : inv.itemId;
        return new StringSelectMenuOptionBuilder()
          .setLabel(label.slice(0, 100))
          .setValue(inv.itemId)
          .setDescription(item ? `${item.rarity} — ${getHourlyRate(item.rarity)} coins/hr` : "Unknown");
      });

      const select = new StringSelectMenuBuilder()
        .setCustomId(`aq:place:${ctx.user.id}`)
        .setPlaceholder("Select a fish to place...")
        .addOptions(options);

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

      const message = await ctx.editReply(
        ui()
          .color(config.colors.default)
          .title("🐠 Place a Fish")
          .text("Select a fish from your inventory to display in your aquarium.")
          .build({ rows: [row] }) as any,
      );

      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        filter: (i) => i.user.id === ctx.user.id,
        time: 60_000,
        max: 1,
      });

      collector.on("collect", async (interaction) => {
        const fishId = interaction.values[0];
        const result = await placeFish(ctx.user.id, fishId);
        const item = allItems.get(fishId);

        if (!result.success) {
          await interaction.update(
            ui()
              .color(config.colors.error)
              .title("🐠 Aquarium")
              .text(result.error!)
              .build({ rows: [] }) as any,
          );
          return;
        }

        await interaction.update(
          ui()
            .color(config.colors.success)
            .title("🐠 Fish Placed!")
            .text(`${item?.emoji ?? "🐟"} **${item?.name ?? fishId}** is now displayed in your aquarium!`)
            .build({ rows: [] }) as any,
        );
      });

      return;
    }

    // ── Remove ──
    if (action === "remove") {
      const aq = await getOrCreateAquarium(ctx.user.id);
      const fish = await getAquariumFish(aq.id);

      if (fish.length === 0) {
        return ctx.editReply(
          ui()
            .color(config.colors.error)
            .title("🐠 Aquarium")
            .text("Your aquarium is empty.")
            .build() as any,
        );
      }

      const options = fish.map((f, i) => {
        const item = allItems.get(f.fishId);
        return new StringSelectMenuOptionBuilder()
          .setLabel(`${i + 1}. ${item?.emoji ?? "🐟"} ${item?.name ?? f.fishId}`)
          .setValue(f.id)
          .setDescription("Return to inventory");
      });

      const select = new StringSelectMenuBuilder()
        .setCustomId(`aq:remove:${ctx.user.id}`)
        .setPlaceholder("Select a fish to remove...")
        .addOptions(options);

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

      const message = await ctx.editReply(
        ui()
          .color(config.colors.default)
          .title("🐠 Remove a Fish")
          .text("Select a fish to return to your inventory.")
          .build({ rows: [row] }) as any,
      );

      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        filter: (i) => i.user.id === ctx.user.id,
        time: 60_000,
        max: 1,
      });

      collector.on("collect", async (interaction) => {
        const entryId = interaction.values[0];
        const result = await removeFishFromAquarium(ctx.user.id, entryId);

        if (!result.success) {
          await interaction.update(
            ui()
              .color(config.colors.error)
              .title("🐠 Aquarium")
              .text(result.error!)
              .build({ rows: [] }) as any,
          );
          return;
        }

        const item = result.fishId ? allItems.get(result.fishId) : null;
        await interaction.update(
          ui()
            .color(config.colors.success)
            .title("🐠 Fish Removed")
            .text(`${item?.emoji ?? "🐟"} **${item?.name ?? "Fish"}** returned to your inventory.`)
            .build({ rows: [] }) as any,
        );
      });
    }
  },
} as Command;
