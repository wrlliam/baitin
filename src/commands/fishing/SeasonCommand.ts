import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { getCurrentSeason, getDaysRemaining } from "@/modules/fishing/seasons";
import { getSeasonalFish } from "@/modules/fishing/seasons";
import { ApplicationCommandType } from "discord.js";

export default {
  name: "season",
  description: "View the current fishing season and its bonuses",
  type: ApplicationCommandType.ChatInput,
  usage: ["/season"],
  defer: true,
  options: [],
  run: async ({ ctx }) => {
    const season = getCurrentSeason();
    const daysLeft = getDaysRemaining();
    const seasonalFish = getSeasonalFish();

    const effectLines = season.effects.map((e) => {
      const pct = Math.round((e.value - 1) * 100);
      const sign = pct >= 0 ? "+" : "";
      const label = e.type
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      return `${sign}${pct}% ${label}`;
    });

    const fishLines = seasonalFish.map(
      (f) => `${f.emoji} **${f.name}** — ${f.rarity} (${f.price.toLocaleString()} ${config.emojis.coin})`,
    );

    const embed = ui()
      .color(config.colors.default)
      .title(`${season.emoji} Season: ${season.name}`)
      .text(`*${season.description}*`)
      .divider()
      .text(
        `**Active Effects:**\n${effectLines.length > 0 ? effectLines.join("\n") : "No special effects"}`,
      )
      .divider()
      .text(
        `**Exclusive Fish This Month:**\n${fishLines.length > 0 ? fishLines.join("\n") : "None"}`,
      )
      .footer(`${daysLeft} day${daysLeft !== 1 ? "s" : ""} remaining this season`);

    return ctx.editReply(embed.build() as any);
  },
} as Command;
