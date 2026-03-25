import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { tip } from "@/data/tip";
import { canFish, doFish } from "@/modules/fishing/fishing";
import { getCurrentWeather } from "@/modules/fishing/weather";
import { locationMap } from "@/data/locations";
import { getCurrentSeason } from "@/modules/fishing/seasons";
import { getOrCreateProfile } from "@/modules/fishing/economy";
import { sellItem } from "@/modules/fishing/inventory";
import { incrementQuestProgress } from "@/modules/fishing/quests";
import { getOrCreateUpgrades } from "@/modules/fishing/upgrades";
import { capitalise } from "@/utils";
import { db } from "@/db";
import { fishingLog } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import {
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} from "discord.js";

export default {
  name: "cast",
  description: "Ready to test your luck?",
  type: ApplicationCommandType.ChatInput,
  usage: ["/cast"],
  defer: "none",
  options: [],
  run: async ({ args, client, ctx }) => {
    const canFishResult = await canFish(ctx.user.id);
    if (!canFishResult.ok) {
      return ctx.reply({
        content: `You can't cast that quickly! Try again <t:${canFishResult.expiresAt}:R>.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    await ctx.deferReply();

    // Check multi-cast tier
    const upgData = await getOrCreateUpgrades(ctx.user.id);
    const castCount = Math.min(upgData.multiCastTier + 1, 6); // tier 0=1x, 1=2x, ..., 5=6x

    const fishPromise = castCount > 1
      ? Promise.all(Array.from({ length: castCount }, () => doFish(ctx.user.id)))
      : doFish(ctx.user.id).then((r) => [r]);

    await new Promise((r) => setTimeout(r, config.fishing.castAnimationDelay));
    const stage2Message =
      Math.random() < 0.6
        ? `${config.emojis.rod} Something's nibbling...`
        : `${config.emojis.rain_drop} The water is still...`;

    await ctx.editReply({ content: stage2Message });

    const fishResults = await fishPromise;
    const fishedResult = fishResults[0];

    // Quest progress (fire-and-forget) — for all catches in multi-cast
    for (const result of fishResults) {
      void incrementQuestProgress(ctx.user.id, "cast");
      if (result.item.category === "fish") {
        void incrementQuestProgress(ctx.user.id, "catch_fish");
        void incrementQuestProgress(ctx.user.id, "catch_rarity", result.item.rarity);
      } else if (result.item.category === "junk") {
        void incrementQuestProgress(ctx.user.id, "catch_junk");
      }
    }

    await new Promise((r) => setTimeout(r, config.fishing.castAnimationDelay));

    const rodName = fishedResult.rodName;
    const isMultiCast = fishResults.length > 1;

    const castResult = ui().color(config.colors.default);

    if (isMultiCast) {
      // ── Multi-cast summary ──
      const totalXp = fishResults.reduce((s, r) => s + r.xpGained, 0);
      const totalCoins = fishResults.reduce((s, r) => s + r.coinsGained, 0);
      const autoSoldTotal = fishResults.reduce((s, r) => s + (r.autoSoldCoins ?? 0), 0);
      const catchLines = fishResults
        .map((r) => `${r.item.emoji} **${r.item.name}** — ${capitalise(r.item.rarity)}${r.fotd ? " ⭐" : ""}${r.autoSold ? " *(auto-sold)*" : ""}`)
        .join("\n");

      castResult
        .title(`🎣 Multi-Cast ×${fishResults.length}`)
        .body(catchLines)
        .divider()
        .text(`${config.emojis.star} **Total XP:** +${totalXp}${fishedResult.levelUp ? ` → **Level ${fishedResult.newLevel}!**` : ""}`)
        .text(`${config.emojis.coin} **Total Coins:** +${totalCoins.toLocaleString()}${autoSoldTotal > 0 ? ` (incl. ${autoSoldTotal.toLocaleString()} auto-sold)` : ""}`)
        .divider();
    } else {
      // ── Single catch display ──
      castResult
        .title(`${fishedResult.item.emoji} ${fishedResult.item.name}${fishedResult.fotd ? " ⭐ Fish of the Day!" : ""}`)
        .body(
          `*${fishedResult.item.description}*\n\nYou reeled in a ${fishedResult.item.name} (${config.emojis.coin} ${fishedResult.item.price}${fishedResult.fotd ? " — **2× coins!**" : ""})`,
        )
        .divider()
        .text(
          `**Rarity:** ${capitalise(fishedResult.item.rarity)}\n**Rod:** ${rodName}${fishedResult.rodBroke ? " ⚠️ BROKEN" : ""}`,
        )
        .text(
          `${config.emojis.star} **XP:** +${fishedResult.xpGained}${fishedResult.levelUp ? ` → **Level ${fishedResult.newLevel}!**` : ""}`,
        )
        .divider();

      // Auto-sell notice
      if (fishedResult.autoSold) {
        castResult
          .text(`💰 **Auto-sold** for **${fishedResult.autoSoldCoins?.toLocaleString()}** ${config.emojis.coin}`)
          .divider();
      }
    }

    // Shared alerts (apply to first result for multi-cast)
    const anyRodBroke = fishResults.some((r) => r.rodBroke);
    if (anyRodBroke) {
      castResult
        .text(
          `${config.emojis.warning} **Rod Broke!** Your rod fell apart! Reverted to **Splintered Twig**. Buy a repair kit or equip a new rod.`,
        )
        .divider();
    }

    if (fishedResult.streakBonus && fishedResult.streakDay) {
      const bonusPct = Math.round(Math.min(fishedResult.streakDay - 1, 10) * 5);
      castResult
        .text(
          `${config.emojis.fire} **${fishedResult.streakDay}-day Streak!** +${bonusPct}% XP & coins bonus.`,
        )
        .divider();
    }

    // Collect all achievements from all casts
    const allAchievements = fishResults.flatMap((r) => r.newAchievements ?? []);
    if (allAchievements.length > 0) {
      const achLines = allAchievements
        .map((a) => `${a.emoji} **${a.name}**\n-# ${a.description}`)
        .join("\n");
      castResult
        .text(
          `${config.emojis.medal} **Achievement${allAchievements.length > 1 ? "s" : ""} Unlocked!**`,
        )
        .text(achLines)
        .divider();
    }

    // Bait alerts (use last result for most accurate remaining count)
    const lastResult = fishResults[fishResults.length - 1];
    if (lastResult.baitRanOut) {
      castResult
        .text(
          `${config.emojis.warning} **Out of bait!** You've used your last one. Buy more from \`/shop\`.`,
        )
        .divider();
    } else if (
      lastResult.baitRemaining !== null &&
      lastResult.baitRemaining !== undefined &&
      lastResult.baitRemaining > 0 &&
      lastResult.baitRemaining <= 5
    ) {
      castResult
        .text(
          `${config.emojis.warning} **Low bait!** Only **${lastResult.baitRemaining}** left.`,
        )
        .divider();
    }

    const weather = getCurrentWeather();
    const castProfile = await getOrCreateProfile(ctx.user.id);
    const loc = locationMap.get(castProfile.equippedLocation ?? "pond");
    const season = getCurrentSeason();
    castResult.footer(`${loc?.emoji ?? "🏞️"} ${loc?.name ?? "Pond"} • ${weather.emoji} ${weather.name} • ${season.emoji} ${season.name} • ${tip()}`);

    // Build action buttons — Sell for single catch only, Species for fish only
    const shouldShowSell = !isMultiCast && fishedResult.item.price > 0 && !fishedResult.autoSold;
    const shouldShowSpecies = !isMultiCast && fishedResult.item.category === "fish";

    const makeButtons = (disabled: boolean): ButtonBuilder[] => {
      const btns: ButtonBuilder[] = [];
      if (shouldShowSell) {
        btns.push(
          new ButtonBuilder()
            .setCustomId(`cast:sell:${fishedResult.item.id}:${ctx.user.id}`)
            .setEmoji(config.emojis.pouch)
            .setLabel("Sell")
            .setStyle(ButtonStyle.Success)
            .setDisabled(disabled),
        );
      }
      if (shouldShowSpecies) {
        btns.push(
          new ButtonBuilder()
            .setCustomId(`cast:species:${fishedResult.item.id}:${ctx.user.id}`)
            .setLabel("📖 Species")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled),
        );
      }
      return btns;
    };

    const hasButtons = shouldShowSell || shouldShowSpecies;

    const buildPayload = (disabled: boolean) =>
      castResult.build(
        hasButtons
          ? {
              rows: [
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                  ...makeButtons(disabled),
                ),
              ],
            }
          : undefined,
      );

    const message = await ctx.editReply({
      content: "",
      ...buildPayload(false),
    } as any);

    if (!hasButtons) return;

    let sold = false;

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === ctx.user.id,
      time: 120_000,
    });

    collector.on("collect", async (i) => {
      if (i.customId.startsWith("cast:sell:")) {
        if (sold) {
          await i.reply({
            flags: MessageFlags.Ephemeral,
            content: `${config.emojis.cross} You've already sold this catch.`,
          });
          return;
        }

        const result = await sellItem(ctx.user.id, fishedResult.item.id, 1);
        if (!result.success) {
          await i.reply({
            flags: MessageFlags.Ephemeral,
            content: `${config.emojis.cross} ${result.error}`,
          });
          return;
        }

        sold = true;
        castResult.footer(
          `Sold for ${result.coinsGained!.toLocaleString()} ${config.emojis.coin}.`,
        );
        await i.update({ content: "", ...buildPayload(true) } as any);
        collector.stop("sold");
        return;
      }

      if (i.customId.startsWith("cast:species:")) {
        const [stats] = await db
          .select({
            total: sql<number>`cast(count(*) as int)`,
            firstCaught: sql<string | null>`min(${fishingLog.caughtAt})`,
          })
          .from(fishingLog)
          .where(
            and(
              eq(fishingLog.userId, ctx.user.id),
              eq(fishingLog.itemId, fishedResult.item.id),
            ),
          );

        const item = fishedResult.item;
        const total = stats?.total ?? 0;
        const firstTs = stats?.firstCaught
          ? Math.floor(new Date(stats.firstCaught).getTime() / 1000)
          : null;

        await i.reply({
          flags: MessageFlags.Ephemeral,
          ...(ui()
            .color(config.colors.default)
            .title(`${item.emoji} ${item.name}`)
            .text(`*${item.description}*`)
            .divider()
            .text(
              `**Total Caught:** ${total}\n` +
                `**First Caught:** ${firstTs ? `<t:${firstTs}:D>` : "Just now"}`,
            )
            .build() as any),
        });
        return;
      }
    });

    collector.on("end", async (_, reason) => {
      if (reason === "sold") return;
      try {
        await message.edit({ content: "", ...buildPayload(true) } as any);
      } catch {}
    });
  },
} as Command;
