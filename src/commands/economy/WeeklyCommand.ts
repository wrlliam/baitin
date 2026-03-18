import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { addCoins, getOrCreateProfile } from "@/modules/fishing/economy";
import { checkCooldown, setCooldown } from "@/modules/fishing/economy_games";
import { ApplicationCommandType } from "discord.js";

const COOLDOWN_SECS = 604800; // 7 days
const BASE_REWARD = 5000;
const LEVEL_BONUS = 150;

export default {
  name: "weekly",
  description: "Claim your weekly coin reward.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/weekly"],
  options: [],
  run: async ({ ctx }) => {
    await ctx.deferReply();

    const cooldown = await checkCooldown(ctx.user.id, "weekly");
    if (!cooldown.ok) {
      return ctx.editReply(
        ui()
          .title("Already Claimed")
          .body(
            `You've already claimed your weekly reward. Come back <t:${Math.floor(cooldown.expiresAt! / 1000)}:R>.`,
          )
          .build() as any,
      );
    }

    const profile = await getOrCreateProfile(ctx.user.id);
    const coins = BASE_REWARD + profile.level * LEVEL_BONUS;

    await addCoins(ctx.user.id, coins);
    await setCooldown(ctx.user.id, "weekly", COOLDOWN_SECS);

    return ctx.editReply(
      ui()
        .color(config.colors.default)
        .title("📆 Weekly Reward")
        .body(
          `You claimed your weekly reward and received **${coins.toLocaleString()}** ${config.emojis.coin}!`,
        )
        .footer("Cooldown: 7 days • Baitin • /help")
        .build() as any,
    );
  },
} as Command;
