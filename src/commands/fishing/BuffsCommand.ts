import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { getActiveBuffs } from "@/modules/fishing/buffs";
import { ApplicationCommandType, MessageFlags } from "discord.js";

const BUFF_LABELS: Record<string, { emoji: string; label: string }> = {
  xp_boost: { emoji: "📖", label: "XP Boost" },
  coin_boost: { emoji: "🪙", label: "Coin Boost" },
  luck_boost: { emoji: "🍀", label: "Luck Boost" },
  cooldown_reduction: { emoji: "⏱️", label: "Cooldown Reduction" },
  hatch_speed: { emoji: "🥚", label: "Hatch Speed" },
  pet_effect_boost: { emoji: "🐾", label: "Pet Effect Boost" },
  cost_reduction: { emoji: "💸", label: "Cost Reduction" },
};

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

    const lines = buffs.map((buff) => {
      const info = BUFF_LABELS[buff.type] ?? { emoji: "✨", label: buff.type.replace(/_/g, " ") };
      const sign = buff.amount >= 0 ? "+" : "";
      const effect = `${sign}${Math.round(buff.amount * 100)}%`;
      const expirySeconds = Math.floor(buff.expiresAt / 1000);
      return `${info.emoji} **${info.label}** — ${effect} (expires <t:${expirySeconds}:R>)`;
    });

    return ctx.editReply(
      ui()
        .color(config.colors.default)
        .title("✨ Active Buffs")
        .text(lines.join("\n"))
        .footer("Use potions to gain more buffs!")
        .build() as any,
    );
  },
} as Command;
