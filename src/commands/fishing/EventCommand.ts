import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { getActiveEvent } from "@/modules/fishing/events";
import config from "@/config";
import { ApplicationCommandType   MessageFlags,
} from "discord.js";

const EFFECT_LABELS: Record<string, string> = {
  xp_multiplier: "XP Multiplier",
  catch_rate: "Catch Rate",
  rarity_boost: "Rarity Boost",
  coin_multiplier: "Coin Multiplier",
};

export default {
  name: "event",
  description: "Check the currently active fishing event.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/event"],
  options: [],
  run: async ({ ctx }) => {
    const event = await getActiveEvent();

    if (!event) {
      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title("🎪 Active Event")
          .text("*No event is currently active. Events trigger randomly — check back soon!*")
          .footer("Use /event to check again anytime.")
          .build() as any,
      );
    }

    const effectLines = event.effects.map((e) => {
      const label = EFFECT_LABELS[e.type] ?? e.type;
      const mult = e.value >= 1 ? `×${e.value}` : `×${e.value} (debuff)`;
      return `• **${label}:** ${mult}`;
    });

    const durationMins = Math.round(event.duration / 60000);
    const entryLine = event.entryFee ? `\n• **Entry Fee:** ${event.entryFee.toLocaleString()} ${config.emojis.coin}` : "";

    return ctx.editReply(
      ui()
        .color(config.colors.default)
        .title(`🎪 ${event.name}`)
        .text(event.description)
        .divider()
        .text(
          `**Effects:**\n${effectLines.join("\n")}\n\n**Duration:** ${durationMins} minutes${entryLine}`,
        )
        .footer("Event effects apply automatically when you /cast during this event.")
        .build() as any,
    );
  },
} as Command;
