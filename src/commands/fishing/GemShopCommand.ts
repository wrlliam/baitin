import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import {
  gemShopItems,
  gemShopMap,
  GEM_SHOP_CATEGORIES,
  type GemShopCategory,
} from "@/data/gemshop";
import { getOrCreateProfile, subtractGems } from "@/modules/fishing/economy";
import { unlockAchievement, hasAchievement } from "@/modules/fishing/achievements";
import { addBuff } from "@/modules/fishing/buffs";
import { rodItems } from "@/data";
import { db } from "@/db";
import { fishingProfile } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";

function buildShopEmbed(category: GemShopCategory, userId: string) {
  const items = gemShopItems.filter((i) => i.category === category);
  const catDef = GEM_SHOP_CATEGORIES.find((c) => c.id === category)!;

  const builder = ui()
    .color(config.colors.default)
    .title(`${config.emojis.gem} Gem Shop — ${catDef.emoji} ${catDef.label}`);

  if (items.length === 0) {
    builder.text("No items in this category.");
  } else {
    const lines = items
      .map(
        (i) =>
          `${i.emoji} **${i.name}** — ${i.gemCost} ${config.emojis.gem}\n-# ${i.description}`,
      )
      .join("\n\n");
    builder.text(lines);
  }

  const rows: ActionRowBuilder<any>[] = [];

  // Category selector
  const catSelect = new StringSelectMenuBuilder()
    .setCustomId(`gemshop:cat:${userId}`)
    .setPlaceholder("Select category")
    .addOptions(
      GEM_SHOP_CATEGORIES.map((c) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(`${c.emoji} ${c.label}`)
          .setValue(c.id)
          .setDefault(c.id === category),
      ),
    );
  rows.push(new ActionRowBuilder().addComponents(catSelect));

  // Buy buttons
  if (items.length > 0) {
    const buyBtns = items.slice(0, 5).map((i) =>
      new ButtonBuilder()
        .setCustomId(`gemshop:buy:${i.id}:${userId}`)
        .setLabel(`Buy ${i.name}`)
        .setEmoji(i.emoji)
        .setStyle(ButtonStyle.Primary),
    );
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(...buyBtns));
  }

  return builder.build({ rows });
}

export default {
  name: "gemshop",
  description: "Spend gems on exclusive items",
  type: ApplicationCommandType.ChatInput,
  usage: ["/gemshop"],
  defer: true,
  options: [],
  run: async ({ ctx }) => {
    const defaultCat: GemShopCategory = "titles";
    const message = await ctx.editReply(
      buildShopEmbed(defaultCat, ctx.user.id) as any,
    );

    const collector = message.createMessageComponentCollector({
      filter: (i) => i.user.id === ctx.user.id,
      time: 180_000,
    });

    collector.on("collect", async (interaction) => {
      // Category switch
      if (
        interaction.customId === `gemshop:cat:${ctx.user.id}` &&
        interaction.isStringSelectMenu()
      ) {
        const cat = interaction.values[0] as GemShopCategory;
        await interaction.update(buildShopEmbed(cat, ctx.user.id) as any);
        return;
      }

      // Buy
      if (interaction.customId.startsWith("gemshop:buy:")) {
        const parts = interaction.customId.split(":");
        const itemId = parts[2];
        const item = gemShopMap.get(itemId);

        if (!item) {
          await interaction.reply({
            flags: MessageFlags.Ephemeral,
            content: `${config.emojis.cross} Item not found.`,
          });
          return;
        }

        // Title items: check if already owned
        if (item.titleId) {
          const marker = `__gem_shop_${item.titleId}`;
          const owned = await hasAchievement(ctx.user.id, marker);
          if (owned) {
            await interaction.reply({
              flags: MessageFlags.Ephemeral,
              content: `${config.emojis.cross} You already own this title!`,
            });
            return;
          }
        }

        const paid = await subtractGems(ctx.user.id, item.gemCost);
        if (!paid) {
          await interaction.reply({
            flags: MessageFlags.Ephemeral,
            content: `${config.emojis.cross} Not enough gems! You need **${item.gemCost}** ${config.emojis.gem}.`,
          });
          return;
        }

        // Apply the purchase
        if (item.titleId) {
          // Mark title as owned via synthetic achievement
          const marker = `__gem_shop_${item.titleId}`;
          await unlockAchievement(ctx.user.id, marker);
        }

        if (item.buff) {
          await addBuff(ctx.user.id, [{
            type: item.buff.type as any,
            amount: item.buff.amount,
            durationMinutes: item.buff.durationMinutes,
          }]);
        }

        if (item.action === "rod_repair") {
          const profile = await getOrCreateProfile(ctx.user.id);
          const rod = profile.equippedRodId ? rodItems.get(profile.equippedRodId) : null;
          if (rod && rod.durability > 0) {
            await db
              .update(fishingProfile)
              .set({ equippedRodDurability: rod.durability })
              .where(eq(fishingProfile.userId, ctx.user.id));
          }
        }

        if (item.action === "streak_saver") {
          // Set a Redis key that the streak logic can check
          const { redis } = await import("@/db/redis");
          await redis.set(`streak:saver:${ctx.user.id}`, "1");
          await redis.send("EXPIRE", [`streak:saver:${ctx.user.id}`, "172800"]); // 48 hours
        }

        await interaction.reply({
          flags: MessageFlags.Ephemeral,
          content: `${config.emojis.tick} Purchased **${item.emoji} ${item.name}** for **${item.gemCost}** ${config.emojis.gem}!`,
        });
        return;
      }
    });

    collector.on("end", () => {});
  },
} as Command;
