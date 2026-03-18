import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { addCoins } from "@/modules/fishing/economy";
import { checkCooldown, setCooldown } from "@/modules/fishing/economy_games";
import { ApplicationCommandType } from "discord.js";

const COOLDOWN_SECS = 1800; // 30 minutes

const SUCCESS_FLAVORS = [
  "A kind sailor tossed you some spare change.",
  "The dockworker felt sorry for you and slipped you a few coins.",
  "A generous fisherman shared part of today's earnings.",
  "An old fishwife took pity and dropped some coins in your bucket.",
  "A tourist mistook you for a street performer and tipped you.",
  "The harbor master felt generous and passed you a small purse.",
];

const FAIL_FLAVORS = [
  "Nobody wanted to help a fisherman who smells like bait.",
  "People walked past pretending not to see you.",
  "You rattled your bucket for an hour — nothing.",
  "A seagull stole your hat. Still no coins.",
  "The dock cat ignored your pleas. So did everyone else.",
];

export default {
  name: "beg",
  description: "Beg at the docks for spare change.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/beg"],
  options: [],
  run: async ({ ctx }) => {

    const cooldown = await checkCooldown(ctx.user.id, "beg");
    if (!cooldown.ok) {
      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title("🪣 Not So Fast!")
          .body(
            `You can't beg again just yet. Come back <t:${Math.floor(cooldown.expiresAt! / 1000)}:R>.`,
          )
          .build() as any,
      );
    }

    await setCooldown(ctx.user.id, "beg", COOLDOWN_SECS);

    const success = Math.random() < 0.7;

    if (success) {
      const coins = 10 + Math.floor(Math.random() * 91);
      await addCoins(ctx.user.id, coins);
      const flavor =
        SUCCESS_FLAVORS[Math.floor(Math.random() * SUCCESS_FLAVORS.length)];
      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title("🪣 Someone Took Pity")
          .body(`${flavor}\n\nYou received **${coins}** ${config.emojis.coin}.`)
          .footer("Cooldown: 30 minutes • Baitin • /help")
          .build() as any,
      );
    } else {
      const flavor =
        FAIL_FLAVORS[Math.floor(Math.random() * FAIL_FLAVORS.length)];
      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title("🪣 No Luck Today")
          .body(`${flavor}\n\nYou received **0** ${config.emojis.coin}.`)
          .footer("Cooldown: 30 minutes • Baitin • /help")
          .build() as any,
      );
    }
  },
} as Command;
