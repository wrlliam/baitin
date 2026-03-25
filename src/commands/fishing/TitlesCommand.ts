import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { titles, titleMap } from "@/data/titles";
import { getOrCreateProfile } from "@/modules/fishing/economy";
import { getUnlockedAchievements } from "@/modules/fishing/achievements";
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

function getUnlockedTitles(
  profile: { level: number; reputation: number; prestigeLevel?: number },
  achievements: string[],
) {
  return titles.filter((t) => {
    switch (t.source) {
      case "level":
        return profile.level >= (t.minLevel ?? Infinity);
      case "achievement":
        return t.achievementId ? achievements.includes(t.achievementId) : false;
      case "collection":
        return t.collectionAchievementId ? achievements.includes(t.collectionAchievementId) : false;
      case "reputation":
        return profile.reputation >= (t.minRep ?? Infinity);
      case "prestige":
        return (profile.prestigeLevel ?? 0) >= (t.minPrestige ?? Infinity);
      default:
        return false;
    }
  });
}

export default {
  name: "titles",
  description: "View and equip your earned titles",
  type: ApplicationCommandType.ChatInput,
  usage: ["/titles"],
  defer: true,
  options: [],
  run: async ({ ctx }) => {
    const profile = await getOrCreateProfile(ctx.user.id);
    const achievements = await getUnlockedAchievements(ctx.user.id);
    const unlocked = getUnlockedTitles(profile, achievements);
    const currentTitle = profile.equippedTitle
      ? titleMap.get(profile.equippedTitle)
      : null;

    const unlockedLines = unlocked.length > 0
      ? unlocked
          .map(
            (t) =>
              `${t.emoji} **${t.name}**${t.id === profile.equippedTitle ? " *(equipped)*" : ""}`,
          )
          .join("\n")
      : "No titles unlocked yet. Keep fishing!";

    const lockedCount = titles.length - unlocked.length;

    const embed = ui()
      .color(config.colors.default)
      .title("🏅 Your Titles")
      .text(
        `**Equipped:** ${currentTitle ? `${currentTitle.emoji} ${currentTitle.name}` : "None"}\n\n` +
          `**Unlocked (${unlocked.length}/${titles.length}):**\n${unlockedLines}` +
          (lockedCount > 0 ? `\n\n-# ${lockedCount} more titles to discover...` : ""),
      );

    const rows: ActionRowBuilder<any>[] = [];

    if (unlocked.length > 0) {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`titles:equip:${ctx.user.id}`)
        .setPlaceholder("Select a title to equip")
        .addOptions(
          unlocked.slice(0, 25).map((t) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(`${t.emoji} ${t.name}`)
              .setValue(t.id)
              .setDefault(t.id === profile.equippedTitle),
          ),
        );
      rows.push(new ActionRowBuilder().addComponents(selectMenu));
    }

    if (currentTitle) {
      rows.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`titles:unequip:${ctx.user.id}`)
            .setLabel("Unequip Title")
            .setStyle(ButtonStyle.Danger),
        ),
      );
    }

    const message = await ctx.editReply(embed.build({ rows }) as any);

    if (rows.length === 0) return;

    const collector = message.createMessageComponentCollector({
      filter: (i) => i.user.id === ctx.user.id,
      time: 120_000,
    });

    collector.on("collect", async (interaction) => {
      if (
        interaction.customId === `titles:equip:${ctx.user.id}` &&
        interaction.isStringSelectMenu()
      ) {
        const titleId = interaction.values[0];
        const titleDef = titleMap.get(titleId);
        await db
          .update(fishingProfile)
          .set({ equippedTitle: titleId })
          .where(eq(fishingProfile.userId, ctx.user.id));

        await interaction.reply({
          flags: MessageFlags.Ephemeral,
          content: `${config.emojis.tick} Title set to **${titleDef?.emoji ?? ""} ${titleDef?.name ?? titleId}**!`,
        });
        return;
      }

      if (interaction.customId === `titles:unequip:${ctx.user.id}`) {
        await db
          .update(fishingProfile)
          .set({ equippedTitle: null })
          .where(eq(fishingProfile.userId, ctx.user.id));

        await interaction.reply({
          flags: MessageFlags.Ephemeral,
          content: `${config.emojis.tick} Title unequipped.`,
        });
        return;
      }
    });

    collector.on("end", () => {});
  },
} as Command;
