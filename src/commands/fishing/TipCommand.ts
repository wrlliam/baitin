import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { tip } from "@/data/tip";
import config from "@/config";
import { ApplicationCommandType } from "discord.js";

export default {
  name: "tip",
  description: "Get a random fishing tip.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/tip"],
  options: [],
  run: async ({ ctx }) => {
    await ctx.reply(
      ui()
        .color(config.colors.default)
        .title("💡 Fishing Tip")
        .text(tip())
        .build() as any,
    );
  },
} as Command;
