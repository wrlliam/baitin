import config from "@/config";
import { ui, progressBar, ButtonStyle } from "@/ui";
import { Command } from "@/core/typings";
import { getOrCreateProfile } from "@/modules/fishing/economy";
import { getOrAssignQuests, claimQuestReward, getQuestDef } from "@/modules/fishing/quests";
import {
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonBuilder,
  ComponentType,
  MessageFlags,
} from "discord.js";
import type { PlayerQuestSelect } from "@/db/schema";

type TabKey = "daily" | "weekly";

function formatRewards(questId: string): string {
  const def = getQuestDef(questId);
  if (!def) return "";
  const parts: string[] = [];
  if (def.rewards.coins) parts.push(`${def.rewards.coins[0]}–${def.rewards.coins[1]} ${config.emojis.coin}`);
  if (def.rewards.xp) parts.push(`${def.rewards.xp[0]}–${def.rewards.xp[1]} XP`);
  if (def.rewards.gems) parts.push(`${def.rewards.gems[0]}–${def.rewards.gems[1]} ${config.emojis.gem}`);
  return parts.join(" • ");
}

function timeUntil(date: Date): string {
  const ms = date.getTime() - Date.now();
  if (ms <= 0) return "now";
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function buildQuestPayload(
  tab: TabKey,
  dailyQuests: PlayerQuestSelect[],
  weeklyQuests: PlayerQuestSelect[],
  gems: number,
) {
  const quests = tab === "daily" ? dailyQuests : weeklyQuests;
  const expiresAt = quests[0]?.expiresAt;

  const builder = ui()
    .color(config.colors.default)
    .title(`${config.emojis.quest} ${tab === "daily" ? "Daily" : "Weekly"} Quests`)
    .text(`${config.emojis.gem} **Gems:** ${gems.toLocaleString()}`)
    .divider();

  if (quests.length === 0) {
    builder.text("No quests available. Try again later!");
  } else {
    for (const quest of quests) {
      const def = getQuestDef(quest.questId);
      if (!def) continue;

      const description = def.description.replace("{goal}", quest.goal.toString());
      const status = quest.claimed
        ? `${config.emojis.tick} Claimed`
        : quest.completed
          ? `${config.emojis.party} Complete!`
          : `${progressBar(quest.progress, quest.goal, 10)}`;

      builder.section(
        `${def.emoji} **${def.name}**\n${description}\n${status}\n-# ${formatRewards(quest.questId)}`,
        quest.completed && !quest.claimed
          ? ui.btn("Claim", `quest:claim:${quest.id}`, ButtonStyle.Success)
          : ui.btn(
              quest.claimed ? "Claimed" : `${quest.progress}/${quest.goal}`,
              `quest:noop:${quest.id}`,
              ButtonStyle.Secondary,
            ),
      );
    }
  }

  if (expiresAt) {
    builder.divider().footer(`Resets in ${timeUntil(expiresAt)}`);
  }

  const tabRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("quest:tab:daily")
      .setLabel("Daily")
      .setStyle(tab === "daily" ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("quest:tab:weekly")
      .setLabel("Weekly")
      .setStyle(tab === "weekly" ? ButtonStyle.Primary : ButtonStyle.Secondary),
  );

  return builder.build({ rows: [tabRow] });
}

export default {
  name: "quests",
  description: "View your daily and weekly quests.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/quests"],
  defer: true,
  options: [],
  run: async ({ ctx }) => {
    const profile = await getOrCreateProfile(ctx.user.id);
    const [daily, weekly] = await Promise.all([
      getOrAssignQuests(ctx.user.id, "daily"),
      getOrAssignQuests(ctx.user.id, "weekly"),
    ]);

    let activeTab: TabKey = "daily";
    let currentGems = profile.gems;

    const payload = buildQuestPayload(activeTab, daily, weekly, currentGems);
    const message = await ctx.editReply(payload as any);

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === ctx.user.id,
      time: 5 * 60 * 1000,
    });

    collector.on("collect", async (i) => {
      const [, action, value] = i.customId.split(":");

      if (action === "tab") {
        activeTab = value as TabKey;
        await i.update(buildQuestPayload(activeTab, daily, weekly, currentGems) as any);
        return;
      }

      if (action === "claim") {
        const result = await claimQuestReward(ctx.user.id, value);
        if (!result.success) {
          await i.reply({
            flags: MessageFlags.Ephemeral,
            content: `${config.emojis.cross} ${result.error}`,
          });
          return;
        }

        currentGems += result.gems;

        // Update the local quest state
        const quest = [...daily, ...weekly].find((q) => q.id === value);
        if (quest) quest.claimed = true;

        const rewardParts: string[] = [];
        if (result.coins > 0) rewardParts.push(`${result.coins.toLocaleString()} ${config.emojis.coin}`);
        if (result.xp > 0) rewardParts.push(`${result.xp} XP`);
        if (result.gems > 0) rewardParts.push(`${result.gems} ${config.emojis.gem}`);

        await i.reply({
          flags: MessageFlags.Ephemeral,
          content: `${config.emojis.tick} Quest reward claimed! **${rewardParts.join(" + ")}**`,
        });

        // Update the main message
        await ctx.editReply(buildQuestPayload(activeTab, daily, weekly, currentGems) as any);
        return;
      }

      if (action === "noop") {
        await i.deferUpdate();
        return;
      }
    });

    collector.on("end", async () => {
      const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("quest:tab:daily")
          .setLabel("Daily")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("quest:tab:weekly")
          .setLabel("Weekly")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
      );
      await message.edit({
        ...buildQuestPayload(activeTab, daily, weekly, currentGems),
        components: [buildQuestPayload(activeTab, daily, weekly, currentGems).components[0], disabledRow],
      } as any).catch(() => {});
    });
  },
} as Command;
