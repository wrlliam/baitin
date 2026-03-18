import config from "@/config";
import { ui, btn } from "@/ui";
import { Command } from "@/core/typings";
import { ApplicationCommandType, ButtonStyle } from "discord.js";

export default {
  name: "getting-started",
  description: "New to Baitin? Start here.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/getting-started"],
  options: [],
  run: async ({ ctx }) => {
    return ctx.reply(
      ui()
        .color(config.colors.default)
        .title("🎣 Welcome to Baitin!")
        .quote(
          "Baitin is a fishing economy bot. Catch fish, earn coins, and compete with others!",
        )
        .divider()
        .section(
          "**Step 1 — Cast Your Line**\nUse `/cast` to catch your first fish. You start with a basic rod.",
          btn("/cast", "gs:cast", ButtonStyle.Secondary),
        )
        .section(
          "**Step 2 — Sell Your Catch**\nUse `/sell all` to pocket coins for everything in your sack.",
          btn("/sell", "gs:sell", ButtonStyle.Secondary),
        )
        .section(
          "**Step 3 — Upgrade Your Gear**\nVisit `/shop` to buy better rods and bait to catch rarer fish.",
          btn("/shop", "gs:shop", ButtonStyle.Secondary),
        )
        .section(
          "**Step 4 — Claim Free Rewards**\nUse `/daily`, `/weekly`, and `/work` for free coins every day.",
          btn("/daily", "gs:daily", ButtonStyle.Secondary),
        )
        .section(
          "**Step 5 — Check Your Stats**\nView your level, gear, and fishing history with `/profile`.",
          btn("/profile", "gs:profile", ButtonStyle.Secondary),
        )
        .divider()
        .body(
          `Need more help? Use \`/help\` to browse all commands, or join our [support server](${config.support}).`,
        )
        .footer("Baitin • /help")
        .build() as any,
    );
  },
} as Command;
