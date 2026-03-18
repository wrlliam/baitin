import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { addCoins, getOrCreateProfile } from "@/modules/fishing/economy";
import { checkCooldown, setCooldown } from "@/modules/fishing/economy_games";
import { ApplicationCommandType   MessageFlags,
} from "discord.js";

const COOLDOWN_SECS = 3600; // 1 hour

const JOBS = [
  "cleaned fishing nets at the docks",
  "repaired crab traps for Old Pete",
  "sorted bait at the bait shop",
  "guided tourists on a fishing trip",
  "unloaded the morning fish catch at the harbor",
  "helped the dockmaster log incoming vessels",
  "polished boat hulls at the marina",
  "ran deliveries for the tackle shop",
  "mended sails on a local fishing trawler",
  "stacked ice crates at the fish market",
  "rowed boats back to the dock after a storm",
  "helped the harbormaster count the daily catch",
];

export default {
  name: "work",
  description: "Do some work around the docks and earn coins.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/work"],
  options: [],
  run: async ({ ctx }) => {

    const cooldown = await checkCooldown(ctx.user.id, "work");
    if (!cooldown.ok) {
      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title("🪣 Still Tired!")
          .body(
            `You're still recovering from your last shift. Come back <t:${Math.floor(cooldown.expiresAt! / 1000)}:R>.`,
          )
          .build() as any,
      );
    }

    const profile = await getOrCreateProfile(ctx.user.id);
    const job = JOBS[Math.floor(Math.random() * JOBS.length)];
    const coins = Math.min(
      1000,
      100 + Math.floor(Math.random() * 400) + profile.level * 10,
    );

    await addCoins(ctx.user.id, coins);
    await setCooldown(ctx.user.id, "work", COOLDOWN_SECS);

    return ctx.editReply(
      ui()
        .color(config.colors.default)
        .title("🪣 You Went to Work")
        .body(
          `You ${job} and earned **${coins.toLocaleString()}** ${config.emojis.coin} for your efforts.`,
        )
        .footer("Cooldown: 1 hour • Baitin • /help")
        .build() as any,
    );
  },
} as Command;
