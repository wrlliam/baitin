import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { addCoins, subtractCoins } from "@/modules/fishing/economy";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  MessageFlags,
} from "discord.js";

const MAX_BET = 10_000;

export default {
  name: "flip",
  description: "Flip a coin and bet on the outcome.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/flip <amount> <side>"],
  options: [
    {
      name: "amount",
      description: "How many coins to bet.",
      type: ApplicationCommandOptionType.Integer,
      required: true,
      minValue: 1,
      maxValue: MAX_BET,
    },
    {
      name: "side",
      description: "Which side to call.",
      type: ApplicationCommandOptionType.String,
      required: true,
      choices: [
        { name: "Heads", value: "heads" },
        { name: "Tails", value: "tails" },
      ],
    },
  ],
  run: async ({ args, ctx }) => {

    const amount = args.getInteger("amount", true);
    const side = args.getString("side", true) as "heads" | "tails";

    const paid = await subtractCoins(ctx.user.id, amount);
    if (!paid) {
      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title(`${config.emojis.cross} Not Enough Coins`)
          .body(
            `You don't have **${amount.toLocaleString()}** ${config.emojis.coin} to bet.`,
          )
          .build() as any,
      );
    }

    const result: "heads" | "tails" = Math.random() < 0.5 ? "heads" : "tails";
    const won = result === side;

    if (won) await addCoins(ctx.user.id, amount * 2);

    return ctx.editReply(
      ui()
        .color(won ? config.colors.success : config.colors.error)
        .title("🪙 Coin Flip")
        .body(
          won
            ? `The coin landed on **${result}**! You called it right.\n\nYou won **${amount.toLocaleString()}** ${config.emojis.coin}!`
            : `The coin landed on **${result}**. You called **${side}**.\n\nYou lost **${amount.toLocaleString()}** ${config.emojis.coin}.`,
        )
        .footer(`Max bet: ${MAX_BET.toLocaleString()} coins • Baitin • /help`)
        .build() as any,
    );
  },
} as Command;
