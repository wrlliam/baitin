import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { battlePassTiers, PREMIUM_COST } from "@/data/battlepass";
import { getOrCreateProfile } from "@/modules/fishing/economy";
import { env } from "@/env";
import {
  resetIfNewSeason,
  claimTier,
  upgradeToPremiumWithGems,
} from "@/modules/fishing/battlepass";
import {
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} from "discord.js";

const TIERS_PER_PAGE = 10;

function progressBar(current: number, total: number, width = 12): string {
  const filled = Math.min(width, Math.floor((current / total) * width));
  return "█".repeat(filled) + "░".repeat(width - filled);
}

async function buildPage(userId: string, page: number) {
  await resetIfNewSeason(userId);
  const profile = await getOrCreateProfile(userId);

  const tier = profile.battlepassTier;
  const xp = profile.battlepassXp;
  const isPremium = profile.battlepassPremium;
  const claimed = (profile.battlepassClaimed as number[]) ?? [];

  const nextTierDef = tier < 30 ? battlePassTiers[tier] : null;
  const xpToNext = nextTierDef?.xpRequired ?? 0;
  const bar = xpToNext > 0 ? progressBar(xp, xpToNext) : progressBar(1, 1);

  const start = page * TIERS_PER_PAGE;
  const end = Math.min(start + TIERS_PER_PAGE, 30);
  const pageTiers = battlePassTiers.slice(start, end);

  const tierLines = pageTiers.map((t) => {
    const reached = t.tier <= tier;
    const isClaimed = claimed.includes(t.tier);
    const status = isClaimed ? "✅" : reached ? "🟢" : "⬛";

    let line = `${status} **Tier ${t.tier}**`;
    line += ` — ${t.freeReward.emoji} ${t.freeReward.label}`;
    if (isPremium) {
      line += ` | 💎 ${t.premiumReward.emoji} ${t.premiumReward.label}`;
    } else {
      // Show what premium gets (locked)
      line += ` | 🔒 ${t.premiumReward.emoji} ${t.premiumReward.label}`;
    }
    return line;
  });

  const builder = ui()
    .color(config.colors.default)
    .title(`🎫 Battle Pass${isPremium ? " ⭐ Premium" : ""}`)
    .text(
      `**Tier ${tier}/30** — ${isPremium ? "Premium" : "Free"} Track\n` +
        `\`[${bar}]\` ${xp}/${xpToNext} XP to next tier`,
    )
    .divider()
    .text(tierLines.join("\n"))
    .footer(`Page ${page + 1}/3 • Earn XP from fishing to progress`);

  return builder;
}

function buildRows(userId: string, page: number, tier: number, claimed: number[], isPremium: boolean) {
  const allBtns: ButtonBuilder[] = [];

  if (page > 0) {
    allBtns.push(
      new ButtonBuilder()
        .setCustomId(`bp:prev:${userId}`)
        .setLabel("◀ Prev")
        .setStyle(ButtonStyle.Secondary),
    );
  }

  if (page < 2) {
    allBtns.push(
      new ButtonBuilder()
        .setCustomId(`bp:next:${userId}`)
        .setLabel("Next ▶")
        .setStyle(ButtonStyle.Secondary),
    );
  }

  // Find next unclaimed tier that's been reached
  const nextUnclaimed = Array.from({ length: 30 }, (_, i) => i + 1)
    .find((t) => t <= tier && !claimed.includes(t));

  if (nextUnclaimed) {
    allBtns.push(
      new ButtonBuilder()
        .setCustomId(`bp:claim:${nextUnclaimed}:${userId}`)
        .setLabel(`Claim Tier ${nextUnclaimed}`)
        .setStyle(ButtonStyle.Success),
    );
  }

  // Premium purchase button — inline with navigation
  if (!isPremium) {
    const skuId = env.BATTLEPASS_SKU_ID;
    if (skuId) {
      // Discord SKU button — opens native purchase modal
      const premiumBtn = new ButtonBuilder()
        .setStyle(ButtonStyle.Premium)
        .setSKUId(skuId);
      allBtns.push(premiumBtn);
    } else {
      // Fallback: gem-based purchase
      const gemBtn = new ButtonBuilder()
        .setCustomId(`bp:premium:${userId}`)
        .setLabel(`Premium (${PREMIUM_COST} 💎)`)
        .setStyle(ButtonStyle.Primary);
      allBtns.push(gemBtn);
    }
  }

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  if (allBtns.length > 0) {
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(...allBtns));
  }

  return rows;
}

export default {
  name: "battlepass",
  description: "View your battle pass progress and claim rewards",
  type: ApplicationCommandType.ChatInput,
  usage: ["/battlepass"],
  defer: true,
  options: [],
  run: async ({ ctx, client }) => {
    let page = 0;

    const profile = await getOrCreateProfile(ctx.user.id);
    const embed = await buildPage(ctx.user.id, page);
    const claimed = (profile.battlepassClaimed as number[]) ?? [];

    const message = await ctx.editReply(
      embed.build({
        rows: buildRows(ctx.user.id, page, profile.battlepassTier, claimed, profile.battlepassPremium),
      }) as any,
    );

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === ctx.user.id,
      time: 180_000,
    });

    collector.on("collect", async (interaction) => {
      if (interaction.customId === `bp:prev:${ctx.user.id}`) {
        page = Math.max(0, page - 1);
      } else if (interaction.customId === `bp:next:${ctx.user.id}`) {
        page = Math.min(2, page + 1);
      } else if (interaction.customId.startsWith("bp:claim:")) {
        const tierNum = parseInt(interaction.customId.split(":")[2]);
        const result = await claimTier(ctx.user.id, tierNum);
        if (!result) {
          await interaction.reply({
            flags: MessageFlags.Ephemeral,
            content: `${config.emojis.cross} Cannot claim that tier.`,
          });
          return;
        }

        let msg = `${config.emojis.tick} **Tier ${tierNum} claimed!**\nFree: ${result.free.emoji} ${result.free.label}`;
        if (result.premium) {
          msg += `\nPremium: ${result.premium.emoji} ${result.premium.label}`;
        }

        await interaction.reply({
          flags: MessageFlags.Ephemeral,
          content: msg,
        });

        // Refresh the page
        const freshProfile = await getOrCreateProfile(ctx.user.id);
        const freshEmbed = await buildPage(ctx.user.id, page);
        const freshClaimed = (freshProfile.battlepassClaimed as number[]) ?? [];
        await message.edit(
          freshEmbed.build({
            rows: buildRows(ctx.user.id, page, freshProfile.battlepassTier, freshClaimed, freshProfile.battlepassPremium),
          }) as any,
        );
        return;
      } else if (interaction.customId === `bp:premium:${ctx.user.id}`) {
        // Gem-based fallback purchase (only reachable when SKU is not configured)
        const success = await upgradeToPremiumWithGems(ctx.user.id);
        if (!success) {
          await interaction.reply({
            flags: MessageFlags.Ephemeral,
            content: `${config.emojis.cross} Not enough gems! You need **${PREMIUM_COST}** 💎.`,
          });
          return;
        }

        await interaction.reply({
          flags: MessageFlags.Ephemeral,
          content: `${config.emojis.tick} **Upgraded to Premium Battle Pass!** You can now claim premium rewards for all reached tiers.`,
        });

        // Refresh
        const freshProfile = await getOrCreateProfile(ctx.user.id);
        const freshEmbed = await buildPage(ctx.user.id, page);
        const freshClaimed = (freshProfile.battlepassClaimed as number[]) ?? [];
        await message.edit(
          freshEmbed.build({
            rows: buildRows(ctx.user.id, page, freshProfile.battlepassTier, freshClaimed, freshProfile.battlepassPremium),
          }) as any,
        );
        return;
      }

      // Default: page navigation — re-fetch to catch entitlement-based premium activation
      const freshProfile = await getOrCreateProfile(ctx.user.id);
      const freshEmbed = await buildPage(ctx.user.id, page);
      const freshClaimed = (freshProfile.battlepassClaimed as number[]) ?? [];
      await interaction.update(
        freshEmbed.build({
          rows: buildRows(ctx.user.id, page, freshProfile.battlepassTier, freshClaimed, freshProfile.battlepassPremium),
        }) as any,
      );
    });

    collector.on("end", async () => {
      try {
        await message.edit({ components: [] });
      } catch {}
    });
  },
} as Command;
