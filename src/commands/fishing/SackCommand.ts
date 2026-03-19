import config from "@/config";
import { ui } from "@/ui";
import { Command, ExtendedInteraction } from "@/core/typings";
import { allItems, sackTiers } from "@/data";
import { getOrCreateProfile } from "@/modules/fishing/economy";
import { subtractCoins } from "@/modules/fishing/economy";
import {
  getInventory,
  getItemCount,
  getSackCapacity,
  sellItem,
} from "@/modules/fishing/inventory";
import { db } from "@/db";
import { fishingProfile } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} from "discord.js";
import { capitalise } from "@/utils";

const CATEGORY_ORDER = [
  "fish",
  "junk",
  "bait",
  "rod",
  "egg",
  "pet",
  "misc",
] as const;

const SACK_NAMES: Record<number, string> = {
  1: "Tattered Pouch",
  2: "Worn Sack",
  3: "Sturdy Sack",
  4: "Heavy Haul Bag",
  5: "Legendary Pack",
};

const SACK_EMOJIS: Record<number, string> = {
  1: "👜",
  2: "🎒",
  3: "💼",
  4: "🧳",
  5: "🌟",
};

const RARITY_SYMBOLS: Record<string, string> = {
  common: "○",
  uncommon: "◆",
  rare: "◆",
  epic: "❖",
  legendary: "✦",
  mythic: "✦✦",
};

const EMPTY_MESSAGES = [
  "Your sack is as empty as the ocean floor... go fill it up! Use `/cast` to start fishing.",
  "Nothing here but echoes. Time to hit the water with `/cast`!",
  "Crickets... your sack is empty. The fish are waiting for you!",
];

function capacityBar(
  used: number,
  capacity: number,
  length: number = 12,
): string {
  const pct = capacity > 0 ? used / capacity : 0;
  const filled = Math.min(length, Math.floor(pct * length));
  const bar = "█".repeat(filled) + "░".repeat(length - filled);
  const pctLabel = Math.round(pct * 100);
  return `\`[${bar}]\` ${used}/${capacity} (${pctLabel}%)`;
}

function buildInventoryContainer(
  inventory: Awaited<ReturnType<typeof getInventory>>,
  used: number,
  capacity: number,
  profile: Awaited<ReturnType<typeof getOrCreateProfile>>,
  nextTier: (typeof sackTiers)[number] | undefined,
  tierName: string,
  tierEmoji: string,
  ctx: ExtendedInteraction,
) {
  const grouped: Record<string, typeof inventory> = {};
  for (const row of inventory) {
    const cat = row.itemType;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(row);
  }

  const footerParts = [capacityBar(used, capacity)];
  if (nextTier) {
    footerParts.push(
      `Upgrade for ${nextTier.upgradeCost.toLocaleString()} coins`,
    );
  } else {
    footerParts.push("Max tier reached!");
  }

  const builder = ui()
    .color(config.colors.default)
    .title(`${tierEmoji} Your ${tierName}`)
    .divider();

  CATEGORY_ORDER.filter((cat) => grouped[cat]?.length).forEach((cat) => {
    grouped[cat].forEach((row) => {
      const item = allItems.get(row.itemId);
      if (!item) return;
      const sellPrice = Math.floor(
        item.price * config.fishing.sellPriceMultiplier,
      );
      builder.section(
        `${item.emoji} **${item.name}**\n-# ×${row.quantity} · ${item.rarity}`,
        new ButtonBuilder()
          .setCustomId(`sack_sell_${row.itemId}_${ctx.user.id}`)
          .setEmoji(config.emojis.coin)
          .setLabel(`${sellPrice}`)
          .setStyle(ButtonStyle.Success),
      );
    });
  });

  builder.footer(footerParts.join(" • "));

  return builder.build();
}

export default {
  name: "sack",
  description: "Manage your sack inventory.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/sack view", "/sack upgrade"],
  options: [
    {
      name: "view",
      description: "View the contents of your sack.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [],
    },
    {
      name: "upgrade",
      description: "Upgrade your sack to hold more loot.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [],
    },
  ],
  run: async ({ args, client, ctx }) => {
    const sub = args.getSubcommand();
    const profile = await getOrCreateProfile(ctx.user.id);

    if (sub === "view") {
      const inventory = await getInventory(ctx.user.id);
      const used = await getItemCount(ctx.user.id);
      const capacity = await getSackCapacity(ctx.user.id);
      const tierName = SACK_NAMES[profile.sackLevel] ?? "Unknown Sack";
      const tierEmoji = SACK_EMOJIS[profile.sackLevel] ?? "🎒";
      const nextTier = sackTiers.find((t) => t.level === profile.sackLevel + 1);

      if (inventory.length === 0) {
        const msg =
          EMPTY_MESSAGES[Math.floor(Math.random() * EMPTY_MESSAGES.length)];
        return ctx.editReply(
          ui()
            .color(config.colors.default)
            .title(`${tierEmoji} Your ${tierName}`)
            .body(msg)
            .footer(
              `${capacityBar(0, capacity)} • ${nextTier ? `Upgrade for ${nextTier.upgradeCost.toLocaleString()} ${config.emojis.coin}` : "Max tier!"}`,
            )
            .build() as any,
        );
      }

      const invPayload = buildInventoryContainer(
        inventory,
        used,
        capacity,
        profile,
        nextTier,
        tierName,
        tierEmoji,
        ctx,
      );

      const message = await ctx.editReply(invPayload as any);

      let selectedItemId: string | null = null;

      const collector = message.createMessageComponentCollector({
        filter: (i) => i.user.id === ctx.user.id,
        time: 120_000,
      });

      collector.on("collect", async (interaction) => {
        if (
          interaction.componentType === ComponentType.Button &&
          interaction.customId.startsWith("sack_sell_") &&
          !interaction.customId.match(/_(?:1|all)_\d+$/)
        ) {
          // Extract item ID from: sack_sell_{itemId}_{userId}
          selectedItemId = interaction.customId
            .replace(/_\d+$/, "")
            .replace("sack_sell_", "");
          const itemRow = (await getInventory(ctx.user.id)).find(
            (r) => r.itemId === selectedItemId,
          );
          const item = allItems.get(selectedItemId);

          if (!item || !itemRow) {
            const freshInv = await getInventory(ctx.user.id);
            await interaction.update(
              buildInventoryContainer(
                freshInv,
                await getItemCount(ctx.user.id),
                capacity,
                profile,
                nextTier,
                tierName,
                tierEmoji,
                ctx,
              ) as any,
            );
            return;
          }

          const sellEach = Math.floor(
            item.price * config.fishing.sellPriceMultiplier,
          );
          const sellTotal = sellEach * itemRow.quantity;
          const raritySymbol = RARITY_SYMBOLS[item.rarity] ?? "○";

          const detailContainer = ui()
            .color(config.colors.default)
            .title(`${item.emoji} ${item.name}`)
            .body(item.description)
            .body(
              `**Rarity:** ${raritySymbol} ${capitalise(item.rarity)}\n**Owned:** ×${itemRow.quantity}\n**Sell Value:** ${sellEach.toLocaleString()} ${config.emojis.coin} each (${sellTotal.toLocaleString()} total)`,
            )
            .build();

          const sellRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`sack_sell_1_${ctx.user.id}`)
              .setLabel("Sell 1")
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId(`sack_sell_all_${ctx.user.id}`)
              .setLabel(`Sell All ×${itemRow.quantity}`)
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId(`sack_back_${ctx.user.id}`)
              .setLabel("◄ Back")
              .setStyle(ButtonStyle.Secondary),
          );

          await interaction.update({
            components: [...detailContainer.components, sellRow],
          } as any);
          return;
        }

        if (interaction.componentType === ComponentType.Button) {
          if (interaction.customId.startsWith("sack_back_")) {
            selectedItemId = null;
            const freshInv = await getInventory(ctx.user.id);
            const freshUsed = await getItemCount(ctx.user.id);

            if (freshInv.length === 0) {
              await interaction.update(
                ui()
                  .color(config.colors.default)
                  .title(`${tierEmoji} Your ${tierName}`)
                  .body("Your sack is now empty!")
                  .footer(capacityBar(0, capacity))
                  .build() as any,
              );
              collector.stop();
              return;
            }

            await interaction.update(
              buildInventoryContainer(
                freshInv,
                freshUsed,
                capacity,
                profile,
                nextTier,
                tierName,
                tierEmoji,
                ctx,
              ) as any,
            );
            return;
          }

          if (
            (interaction.customId.startsWith("sack_sell_1_") ||
              interaction.customId.startsWith("sack_sell_all_")) &&
            selectedItemId
          ) {
            const itemRow = (await getInventory(ctx.user.id)).find(
              (r) => r.itemId === selectedItemId,
            );
            const qty =
              interaction.customId === "sack_sell_all"
                ? (itemRow?.quantity ?? 1)
                : 1;
            const result = await sellItem(ctx.user.id, selectedItemId, qty);

            if (!result.success) {
              await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: `${config.emojis.cross} ${result.error}`,
              });
              return;
            }

            await interaction.reply({
              flags: MessageFlags.Ephemeral,
              content: `${config.emojis.tick} Sold **${qty}×** item for **${result.coinsGained!.toLocaleString()}** ${config.emojis.coin}!`,
            });

            const freshInv = await getInventory(ctx.user.id);
            const freshUsed = await getItemCount(ctx.user.id);
            const stillOwned = freshInv.find(
              (r) => r.itemId === selectedItemId,
            );

            if (freshInv.length === 0) {
              await message.edit(
                ui()
                  .color(config.colors.default)
                  .title(`${tierEmoji} Your ${tierName}`)
                  .body("Your sack is now empty!")
                  .footer(capacityBar(0, capacity))
                  .build() as any,
              );
              collector.stop();
              return;
            }

            if (stillOwned) {
              const item = allItems.get(selectedItemId!);
              if (item) {
                const sellEach = Math.floor(
                  item.price * config.fishing.sellPriceMultiplier,
                );
                const sellTotal = sellEach * stillOwned.quantity;
                const raritySymbol = RARITY_SYMBOLS[item.rarity] ?? "○";
                const detailPayload = ui()
                  .color(config.colors.default)
                  .title(`${item.emoji} ${item.name}`)
                  .body(item.description)
                  .body(
                    `**Rarity:** ${raritySymbol} ${capitalise(item.rarity)}\n**Owned:** ×${stillOwned.quantity}\n**Sell Value:** ${sellEach.toLocaleString()} ${config.emojis.coin} each (${sellTotal.toLocaleString()} total)`,
                  )
                  .build();
                const sellRow =
                  new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                      .setCustomId(`sack_sell_1_${ctx.user.id}`)
                      .setLabel("Sell 1")
                      .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                      .setCustomId(`sack_sell_all_${ctx.user.id}`)
                      .setLabel(`Sell All ×${stillOwned.quantity}`)
                      .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                      .setCustomId(`sack_back_${ctx.user.id}`)
                      .setLabel("◄ Back")
                      .setStyle(ButtonStyle.Secondary),
                  );
                await message.edit({
                  components: [...detailPayload.components, sellRow],
                } as any);
              }
            } else {
              selectedItemId = null;
              await message.edit(
                buildInventoryContainer(
                  freshInv,
                  freshUsed,
                  capacity,
                  profile,
                  nextTier,
                  tierName,
                  tierEmoji,
                  ctx,
                ) as any,
              );
            }
            return;
          }
        }
      });

      collector.on("end", async () => {
        try {
          await message.edit({ components: [] });
        } catch {}
      });

      return;
    }

    if (sub === "upgrade") {
      const currentLevel = profile.sackLevel;
      const currentTier = sackTiers.find((t) => t.level === currentLevel) ?? {
        level: currentLevel,
        capacity: 0,
        upgradeCost: 0,
      };
      const nextTier = sackTiers.find((t) => t.level === currentLevel + 1);

      if (!nextTier) {
        const tierEmoji = SACK_EMOJIS[currentLevel] ?? "🌟";
        return ctx.editReply(
          ui()
            .color(config.colors.default)
            .title(`${tierEmoji} Already Maxed Out!`)
            .body(
              `Your **${SACK_NAMES[currentLevel]}** is already the most powerful sack available. Flex on 'em! 💪`,
            )
            .build() as any,
        );
      }

      if (profile.coins < nextTier.upgradeCost) {
        const missing = nextTier.upgradeCost - profile.coins;
        return ctx.editReply(
          ui()
            .color(config.colors.default)
            .title(`${config.emojis.cross} Not Enough Coins!`)
            .body(
              `You need **${nextTier.upgradeCost.toLocaleString()}** ${config.emojis.coin} to upgrade to a **${SACK_NAMES[nextTier.level]}**.\nYou're **${missing.toLocaleString()}** ${config.emojis.coin} short — go sell some fish!\n\n**Your Balance:** ${config.emojis.coin} ${profile.coins.toLocaleString()}\n**Cost:** ${config.emojis.coin} ${nextTier.upgradeCost.toLocaleString()}`,
            )
            .build() as any,
        );
      }

      await subtractCoins(ctx.user.id, nextTier.upgradeCost);
      await db
        .update(fishingProfile)
        .set({ sackLevel: nextTier.level })
        .where(eq(fishingProfile.userId, ctx.user.id));

      const newEmoji = SACK_EMOJIS[nextTier.level] ?? "🎒";
      const hasMoreUpgrades = sackTiers.find(
        (t) => t.level === nextTier.level + 1,
      );

      const upgradeInfo = hasMoreUpgrades
        ? `**Next Upgrade:** ${SACK_EMOJIS[nextTier.level + 1] ?? "🌟"} ${SACK_NAMES[nextTier.level + 1] ?? "Max Tier"} — ${hasMoreUpgrades.upgradeCost.toLocaleString()} ${config.emojis.coin}`
        : "🏆 **Max Tier!** You've reached the pinnacle of sack technology. Legendary status achieved!";

      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title(`${newEmoji} Sack Upgraded!`)
          .body("Cha-ching! Your new sack is ready to hold more loot!")
          .divider()
          .body(
            `**Before:** ${SACK_EMOJIS[currentLevel]} ${SACK_NAMES[currentLevel]} (${currentTier.capacity} slots)\n**After:** ${newEmoji} ${SACK_NAMES[nextTier.level]} (${nextTier.capacity} slots)\n\n${upgradeInfo}`,
          )
          .build() as any,
      );
    }
  },
} as Command;
