import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { addCoins, getOrCreateProfile } from "@/modules/fishing/economy";
import { checkCooldown, setCooldown } from "@/modules/fishing/economy_games";
import { ApplicationCommandType   MessageFlags,
} from "discord.js";

const COOLDOWN_SECS = 86400; // 24 hours
const BASE_REWARD = 500;
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
      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title("📅 Already Claimed")
          .body(
            `You've already claimed your daily reward. Come back <t:${Math.floor(cooldown.expiresAt! / 1000)}:R>.`,
          )
          .build() as any,
      );
    }

    const profile = await getOrCreateProfile(ctx.user.id);
    const coins = BASE_REWARD + profile.level * LEVEL_BONUS;

    await addCoins(ctx.user.id, coins);
    await setCooldown(ctx.user.id, "daily", COOLDOWN_SECS);

    return ctx.editReply(
      ui()
        .color(config.colors.default)
        .title("📅 Daily Reward")
        .body(
          `You claimed your daily reward and received **${coins.toLocaleString()}** ${config.emojis.coin}!`,
        )
        .footer("Cooldown: 24 hours • Baitin • /help")
        .build() as any,
    );
  },
} as Command;
