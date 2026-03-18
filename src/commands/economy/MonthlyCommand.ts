import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { addCoins, getOrCreateProfile } from "@/modules/fishing/economy";
import { checkCooldown, setCooldown } from "@/modules/fishing/economy_games";
import { ApplicationCommandType } from "discord.js";

const COOLDOWN_SECS = 2592000; // 30 days
const BASE_REWARD = 25000;
const LEVEL_BONUS = 500;

export default {
  name: "monthly",
  description: "Claim your monthly coin reward.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/monthly"],
  options: [],
  run: async ({ ctx }) => {
    await ctx.deferReply();

    const cooldown = await checkCooldown(ctx.user.id, "monthly");
    if (!cooldown.ok) {
      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title("🗓️ Already Claimed")
          .body(
            `You've already claimed your monthly reward. Come back <t:${Math.floor(cooldown.expiresAt! / 1000)}:R>.`,
          )
          .build() as any,
      );
    }

    const profile = await getOrCreateProfile(ctx.user.id);
    const coins = BASE_REWARD + profile.level * LEVEL_BONUS;

    await addCoins(ctx.user.id, coins);
    await setCooldown(ctx.user.id, "monthly", COOLDOWN_SECS);

    return ctx.editReply(
      ui()
        .color(config.colors.default)
        .title("🗓️ Monthly Reward")
        .body(
          `You claimed your monthly reward and received **${coins.toLocaleString()}** ${config.emojis.coin}!`,
        )
        .footer("Cooldown: 30 days • Baitin • /help")
        .build() as any,
    );
  },
} as Command;
