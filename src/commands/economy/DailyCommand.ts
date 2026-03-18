import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { addCoins, getOrCreateProfile } from "@/modules/fishing/economy";
import { checkCooldown, setCooldown } from "@/modules/fishing/economy_games";
import { ApplicationCommandType, MessageFlags } from "discord.js";

const COOLDOWN_SECS = 86400; // 24 hours
const BASE_REWARD = 125;
const LEVEL_BONUS = 25;

export default {
  name: "daily",
  description: "Claim your daily coin reward.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/daily"],
  options: [],
  run: async ({ ctx }) => {
    const cooldown = await checkCooldown(ctx.user.id, "daily");
    if (!cooldown.ok) {
      const nextAvailable = Math.floor(cooldown.expiresAt! / 1000);
      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title("📅 Already Claimed Today")
          .body(`You've already claimed your daily reward.`)
          .divider()
          .text(
            `**Next available:** <t:${nextAvailable}:R> (<t:${nextAvailable}:t>)`
          )
          .divider()
          .text(
            `In the meantime, try **/cast** to fish, **/work** for coins, or check **/leaderboard** to see your rank!`
          )
          .footer("Daily rewards reset every 24 hours")
          .build() as any,
      );
    }

    const profile = await getOrCreateProfile(ctx.user.id);
    const coins = BASE_REWARD + profile.level * LEVEL_BONUS;

    await addCoins(ctx.user.id, coins);
    await setCooldown(ctx.user.id, "daily", COOLDOWN_SECS);

    const baseReward = BASE_REWARD;
    const levelBonus = profile.level * LEVEL_BONUS;

    return ctx.editReply(
      ui()
        .color(config.colors.default)
        .title("📅 Daily Reward Claimed!")
        .body(
          `You claimed your daily reward!`
        )
        .divider()
        .text(
          `**Base Reward:** ${baseReward.toLocaleString()} ${config.emojis.coin}\n**Level Bonus:** +${levelBonus.toLocaleString()} ${config.emojis.coin} (${profile.level} × ${LEVEL_BONUS})\n**Total:** **${coins.toLocaleString()}** ${config.emojis.coin}`
        )
        .divider()
        .text(
          `Next daily available: <t:${Math.floor(Date.now() / 1000 + COOLDOWN_SECS)}:R>`
        )
        .footer("Daily rewards increase with your level!")
        .build() as any,
    );
  },
} as Command;
