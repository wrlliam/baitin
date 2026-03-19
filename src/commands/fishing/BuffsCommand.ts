import config from "@/config";
import { ui, ButtonStyle } from "@/ui";
import { Command } from "@/core/typings";
import { getActiveBuffs, extendBuff } from "@/modules/fishing/buffs";
import { getOrCreateProfile } from "@/modules/fishing/economy";
import { subtractGems } from "@/modules/fishing/quests";
import {
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonBuilder,
  ComponentType,
  MessageFlags,
} from "discord.js";

const BUFF_LABELS: Record<string, { emoji: string; label: string }> = {
  xp_boost: { emoji: config.emojis.xp_boost, label: "XP Boost" },
  coin_boost: { emoji: config.emojis.coin_boost, label: "Coin Boost" },
  luck_boost: { emoji: config.emojis.luck_boost, label: "Luck Boost" },
  cooldown_reduction: { emoji: config.emojis.cooldown_reduction, label: "Cooldown Reduction" },
  hatch_speed: { emoji: config.emojis.hatch_speed, label: "Hatch Speed" },
  pet_effect_boost: { emoji: config.emojis.pet_effect_boost, label: "Pet Effect Boost" },
  cost_reduction: { emoji: config.emojis.cost_reduction, label: "Cost Reduction" },
};

const GEM_EXTEND_COST = 5; // gems per +10 min extension
const EXTEND_MINUTES = 10;

export default {
  name: "buffs",
  description: "View your currently active buffs.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/buffs"],
  defer: true,
  options: [],
  run: async ({ ctx }) => {
    const buffs = await getActiveBuffs(ctx.user.id);

    if (buffs.length === 0) {
      return ctx.editReply({
        content: `${config.emojis.cross} No active buffs.`,
        flags: MessageFlags.Ephemeral,
      } as any);
    }

    const profile = await getOrCreateProfile(ctx.user.id);

    const lines = buffs.map((buff, i) => {
      const info = BUFF_LABELS[buff.type] ?? { emoji: "✨", label: buff.type.replace(/_/g, " ") };
      const sign = buff.amount >= 0 ? "+" : "";
      const effect = `${sign}${Math.round(buff.amount * 100)}%`;
      const expirySeconds = Math.floor(buff.expiresAt / 1000);
      return `${info.emoji} **${info.label}** — ${effect} (expires <t:${expirySeconds}:R>)`;
    });

    const builder = ui()
      .color(config.colors.default)
      .title(`${config.emojis.sparkles} Active Buffs`)
      .text(lines.join("\n"))
      .divider()
      .footer(
        `${config.emojis.gem} ${profile.gems} gems • ${GEM_EXTEND_COST} gems = +${EXTEND_MINUTES} min to all buffs`,
      );

    const extendBtn = new ButtonBuilder()
      .setCustomId("buffs:extend")
      .setLabel(`Extend All (+${EXTEND_MINUTES}m) — ${GEM_EXTEND_COST} 💎`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(profile.gems < GEM_EXTEND_COST);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(extendBtn);

    const message = await ctx.editReply(builder.build({ rows: [row] }) as any);

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === ctx.user.id,
      time: 60_000,
    });

    collector.on("collect", async (i) => {
      if (i.customId !== "buffs:extend") return i.deferUpdate();

      const success = await subtractGems(ctx.user.id, GEM_EXTEND_COST);
      if (!success) {
        return i.reply({
          flags: MessageFlags.Ephemeral,
          content: `${config.emojis.cross} Not enough gems! You need **${GEM_EXTEND_COST}** ${config.emojis.gem}.`,
        });
      }

      await extendBuff(ctx.user.id, EXTEND_MINUTES);

      const updatedBuffs = await getActiveBuffs(ctx.user.id);
      const updatedProfile = await getOrCreateProfile(ctx.user.id);

      const updatedLines = updatedBuffs.map((buff) => {
        const info = BUFF_LABELS[buff.type] ?? { emoji: "✨", label: buff.type.replace(/_/g, " ") };
        const sign = buff.amount >= 0 ? "+" : "";
        const effect = `${sign}${Math.round(buff.amount * 100)}%`;
        const expirySeconds = Math.floor(buff.expiresAt / 1000);
        return `${info.emoji} **${info.label}** — ${effect} (expires <t:${expirySeconds}:R>)`;
      });

      const updatedBuilder = ui()
        .color(config.colors.success)
        .title(`${config.emojis.sparkles} Buffs Extended!`)
        .text(updatedLines.join("\n"))
        .divider()
        .footer(
          `${config.emojis.gem} ${updatedProfile.gems} gems • ${GEM_EXTEND_COST} gems = +${EXTEND_MINUTES} min to all buffs`,
        );

      const updatedExtendBtn = new ButtonBuilder()
        .setCustomId("buffs:extend")
        .setLabel(`Extend All (+${EXTEND_MINUTES}m) — ${GEM_EXTEND_COST} 💎`)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(updatedProfile.gems < GEM_EXTEND_COST);

      const updatedRow = new ActionRowBuilder<ButtonBuilder>().addComponents(updatedExtendBtn);

      await i.update(updatedBuilder.build({ rows: [updatedRow] }) as any);
    });
  },
} as Command;
