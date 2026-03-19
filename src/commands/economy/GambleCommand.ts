import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import {
  addCoins,
  getOrCreateProfile,
  subtractCoins,
} from "@/modules/fishing/economy";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  MessageFlags,
} from "discord.js";

const MAX_BET = 250_000;

const WIN_FLAVORS = [
  "Fortune favors the bold — and you're living proof.",
  "The tides turned in your favor tonight.",
  "Sometimes the fish just jumps into the boat.",
  "You played it cool and walked away richer.",
  "The harbor gods smiled upon you.",
];

const LOSE_FLAVORS = [
  "The sea giveth, and the sea taketh away.",
  "Even the best fishermen lose their bait sometimes.",
  "You tossed the line and the fish didn't bite.",
  "Risk and reward — today it was all risk.",
  "Better luck next cast.",
];

export default {
  name: "gamble",
  description: "Bet your coins for a 50/50 shot at doubling up.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/gamble <price>"],
  defer: "none",
  options: [
    {
      name: "price",
      description: "How many coins to gamble.",
      type: ApplicationCommandOptionType.Integer,
      required: true,
      minValue: 1,
      maxValue: MAX_BET,
    },
  ],
  run: async ({ args, ctx }) => {
    const amount = args.getInteger("price", true);

    const paid = await subtractCoins(ctx.user.id, amount);
    if (!paid) {
      return ctx.reply({
        ...ui()
          .color(config.colors.default)
          .title(`${config.emojis.cross} Not Enough Coins`)
          .body(
            `You need **${amount.toLocaleString()}** ${config.emojis.coin} to place that bet.`,
          )
          .build(),
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      } as any);
    }

    await ctx.deferReply({ flags: MessageFlags.IsComponentsV2 });

    const won = Math.random() < 0.5;
    if (won) await addCoins(ctx.user.id, amount * 2);

    const flavor = won
      ? WIN_FLAVORS[Math.floor(Math.random() * WIN_FLAVORS.length)]
      : LOSE_FLAVORS[Math.floor(Math.random() * LOSE_FLAVORS.length)];

    return ctx.editReply(
      ui()
        .color(won ? config.colors.success : config.colors.error)
        .title("🎲 Gamble")
        .body(
          won
            ? `${flavor}\n\nYou won **${amount.toLocaleString()}** ${config.emojis.coin}! Your net gain: **+${amount.toLocaleString()}** ${config.emojis.coin}.`
            : `${flavor}\n\nYou lost **${amount.toLocaleString()}** ${config.emojis.coin}.`,
        )
        .footer(`Max bet: ${MAX_BET.toLocaleString()} coins • Baitin • /help`)
        .build() as any,
    );
  },
} as Command;
