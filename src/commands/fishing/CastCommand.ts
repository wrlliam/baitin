import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { rods } from "@/data";
import { tip } from "@/data/tip";
import { getOrCreateProfile } from "@/modules/fishing/economy";
import { canFish, doFish } from "@/modules/fishing/fishing";
import { capitalise } from "@/utils";
import { ApplicationCommandType, MessageFlags } from "discord.js";

export default {
  name: "cast",
  description: "Ready to test your luck?",
  type: ApplicationCommandType.ChatInput,
  usage: ["/cast"],
  options: [],
  run: async ({ args, client, ctx }) => {

    const canFishResult = await canFish(ctx.user.id);
    if (!canFishResult.ok) {
      const remainingMs = canFishResult.remaining;
      const remainingSecs = Math.ceil(remainingMs / 1000);
      return ctx.editReply({
        content: `You can't cast that quickly! Please wait **${remainingSecs}s** before trying again.`,
      });
    }

    const fishPromise = doFish(ctx.user.id);

    await new Promise((r) => setTimeout(r, config.fishing.castAnimationDelay));
    const stage2Message =
      Math.random() < 0.6
        ? "🎣 Something's nibbling..."
        : "🌊 The water is still...";

    await ctx.editReply({ content: stage2Message });

    const fishedResult = await fishPromise;
    const profile = await getOrCreateProfile(ctx.user.id);

    await new Promise((r) => setTimeout(r, config.fishing.castAnimationDelay));

    const rodName =
      rods.find((r) => r.id === profile.equippedRodId)?.name ??
      "Splintered Twig";

    let extraBody = "";
    if (fishedResult.rodBroke) {
      extraBody =
        "\n\n⚠️ **Rod Broke!** Your rod fell apart! Reverted to **Splintered Twig**. Buy a repair kit or equip a new rod.";
    }
    if (fishedResult.streakBonus && fishedResult.streakDay) {
      const bonusPct = Math.round(Math.min(fishedResult.streakDay - 1, 10) * 5);
      extraBody += `\n\n🔥 **${fishedResult.streakDay}-day streak!** +${bonusPct}% XP & coins bonus.`;
    }
    if (fishedResult.newAchievements && fishedResult.newAchievements.length > 0) {
      const achLines = fishedResult.newAchievements
        .map((a) => `${a.emoji} **${a.name}** — ${a.description} (+${a.coinReward}${config.emojis.coin})`)
        .join("\n");
      extraBody += `\n\n🏅 **Achievement${fishedResult.newAchievements.length > 1 ? "s" : ""} Unlocked!**\n${achLines}`;
    }

    const castResult = ui()
      .color(config.colors.default)
      .title(`${fishedResult.item.emoji} ${fishedResult.item.name}`)
      .body(
        `*${fishedResult.item.description}*\n\nYou reeled in a **${fishedResult.item.name}** \`(${config.emojis.coin} ${fishedResult.item.price})\``,
      )
      .divider()
      .body(
        `**Rarity:** ${capitalise(fishedResult.item.rarity)} • **Rod:** ${rodName} • **XP:** +${fishedResult.xpGained}${fishedResult.levelUp ? ` ${config.emojis.up_arrow} **Level ${fishedResult.newLevel}!**` : ""}${extraBody}`,
      )
      .footer(tip())
      .build();
    await ctx.editReply({ content: "", ...castResult } as any);
  },
} as Command;
