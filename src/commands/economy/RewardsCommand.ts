import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import {
  canClaimReward,
  claimReward,
  REWARDS,
  type RewardType,
} from "@/modules/fishing/rewards";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
} from "discord.js";

const TYPE_LABELS: Record<RewardType, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

const TYPE_EMOJIS: Record<RewardType, string> = {
  daily: "☀️",
  weekly: "📅",
  monthly: "🌙",
};

export default {
  name: "rewards",
  description: "Claim your daily, weekly, or monthly rewards.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/rewards daily", "/rewards weekly", "/rewards monthly"],
  options: [
    {
      name: "daily",
      description: "Claim your daily reward.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [],
    },
    {
      name: "weekly",
      description: "Claim your weekly reward.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [],
    },
    {
      name: "monthly",
      description: "Claim your monthly reward.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [],
    },
  ],
  run: async ({ args, ctx }) => {
    await ctx.deferReply();
    const type = args.getSubcommand() as RewardType;
    const { canClaim, expiresAt } = await canClaimReward(ctx.user.id, type);

    if (!canClaim) {
      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title(`${TYPE_EMOJIS[type]} ${TYPE_LABELS[type]} Reward`)
          .body(
            `You already claimed your ${TYPE_LABELS[type].toLowerCase()} reward!\nCome back <t:${Math.floor(expiresAt! / 1000)}:R>.`,
          )
          .build() as any,
      );
    }

    const result = await claimReward(ctx.user.id, type);
    if (!result.success || !result.reward) {
      return ctx.editReply({
        content: `${config.emojis.cross} ${result.error}`,
      });
    }

    const reward = result.reward;
    const rewardLines: string[] = [];
    if (reward.coins > 0)
      rewardLines.push(
        `${config.emojis.coin} **${reward.coins.toLocaleString()} coins**`,
      );
    for (const item of reward.items) {
      rewardLines.push(`📦 **${item.id}** ×${item.qty}`);
    }
    if (reward.xp > 0) rewardLines.push(`⭐ **${reward.xp} XP**`);

    return ctx.editReply(
      ui()
        .color(config.colors.default)
        .title(`${TYPE_EMOJIS[type]} ${TYPE_LABELS[type]} Reward Claimed!`)
        .body(rewardLines.join("\n"))
        .build() as any,
    );
  },
} as Command;
