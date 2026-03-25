import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { getFishOfTheDay } from "@/modules/fishing/fishing";
import { capitalise } from "@/utils";
import { ApplicationCommandType } from "discord.js";

export default {
  name: "fotd",
  description: "See today's featured Fish of the Day",
  type: ApplicationCommandType.ChatInput,
  usage: ["/fotd"],
  defer: true,
  options: [],
  run: async ({ ctx }) => {
    const fish = getFishOfTheDay();

    const embed = ui()
      .color(config.colors.default)
      .title(`⭐ Fish of the Day`)
      .text(
        `${fish.emoji} **${fish.name}**\n` +
          `*${fish.description}*\n\n` +
          `**Rarity:** ${capitalise(fish.rarity)}\n` +
          `**Base Value:** ${config.emojis.coin} ${fish.price.toLocaleString()}\n\n` +
          `Catch this fish today for **2× coins**!`,
      )
      .footer("Resets daily at midnight UTC")
      .build();

    await ctx.editReply(embed as any);
  },
} as Command;
