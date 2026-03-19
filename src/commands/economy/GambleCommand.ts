import config from "@/config";
import { ui, ButtonStyle } from "@/ui";
import { Command } from "@/core/typings";
import {
  addCoins,
  subtractCoins,
} from "@/modules/fishing/economy";
import {
  createGame,
  generateCard,
  handStr,
  handValue,
  cardStr,
} from "@/modules/games/blackjack";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  MessageFlags,
} from "discord.js";

const MAX_BET = 250_000;

const amountOption = {
  name: "amount",
  description: "How many coins to bet.",
  type: ApplicationCommandOptionType.Integer,
  required: true,
  minValue: 1,
  maxValue: MAX_BET,
};

export default {
  name: "gamble",
  description: "Play various games to win or lose coins.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/gamble coinflip <amount>", "/gamble blackjack <amount>"],
  defer: "none",
  options: [
    {
      name: "coinflip",
      description: "50/50 chance to double your coins.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [amountOption],
    },
    {
      name: "blackjack",
      description: "Play blackjack against the dealer.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [amountOption],
    },
    {
      name: "highlow",
      description: "Guess if the next card is higher or lower.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [amountOption],
    },
    {
      name: "roulette",
      description: "Spin the wheel and pick a color.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [amountOption],
    },
    {
      name: "dice",
      description: "Roll dice and hope for a lucky number (7, 11, 13).",
      type: ApplicationCommandOptionType.Subcommand,
      options: [amountOption],
    },
  ],
  run: async ({ args, ctx }) => {
    const subcommand = ctx.options.getSubcommand();
    const amount = args.getInteger("amount", true);

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
        flags: MessageFlags.Ephemeral,
      } as any);
    }

    switch (subcommand) {
      case "coinflip":
        return flipGame(ctx, amount);
      case "blackjack":
        return blackjackGame(ctx, amount);
      case "highlow":
        return highLowGame(ctx, amount);
      case "roulette":
        return rouletteGame(ctx, amount);
      case "dice":
        return diceGame(ctx, amount);
      default:
        return ctx.reply({
          ...ui()
            .color(config.colors.error)
            .title("Unknown Game")
            .body("That game mode isn't available.")
            .build(),
          flags: MessageFlags.Ephemeral,
        } as any);
    }
  },
} as Command;

// ─── Game Implementations ───────────────────────────────────────────

const FLIP_WIN = ["Fortune favors the bold!", "Heads, you win!", "Lucky flip!", "The odds were with you!"];
const FLIP_LOSE = ["Better luck next time.", "Tails, you lose!", "Not today.", "The coin wasn't kind."];

async function flipGame(ctx: any, amount: number) {
  await ctx.deferReply({});
  const won = Math.random() < 0.5;
  if (won) await addCoins(ctx.user.id, amount * 2);

  return ctx.editReply(
    ui()
      .color(won ? config.colors.success : config.colors.error)
      .title("🪙 Coin Flip")
      .body(
        (won ? FLIP_WIN : FLIP_LOSE)[Math.floor(Math.random() * (won ? FLIP_WIN.length : FLIP_LOSE.length))] +
        "\n\n" +
        (won
          ? `You won **${amount.toLocaleString()}** ${config.emojis.coin}! Net: **+${amount.toLocaleString()}** ${config.emojis.coin}.`
          : `You lost **${amount.toLocaleString()}** ${config.emojis.coin}.`),
      )
      .footer(`Max bet: ${MAX_BET.toLocaleString()} coins`)
      .build() as any,
  );
}

async function blackjackGame(ctx: any, amount: number) {
  await ctx.deferReply({});

  const game = createGame(ctx.user.id, amount);
  const gameId = `bj:${ctx.user.id}:${game.timestamp}`;
  const playerValue = handValue(game.playerCards);

  // Check for natural blackjack
  if (playerValue === 21) {
    const dealerValue = handValue(game.dealerCards);
    const winnings = dealerValue === 21 ? amount : amount * 2.5;
    await addCoins(ctx.user.id, Math.floor(winnings));

    return ctx.editReply(
      ui()
        .color(dealerValue === 21 ? config.colors.default : config.colors.success)
        .title("♠ Blackjack!")
        .body(
          `**Your hand:** ${handStr(game.playerCards)} (**21**)\n**Dealer:** ${cardStr(game.dealerCards[0])} + [Hidden]\n\n` +
          (dealerValue === 21
            ? `Dealer also has blackjack! **Push** — you get your bet back.`
            : `You hit blackjack! You win **${Math.floor(winnings).toLocaleString()}** ${config.emojis.coin}!`),
        )
        .build() as any,
    );
  }

  // Reply with hit/stand buttons
  return ctx.editReply(
    ui()
      .color(config.colors.default)
      .title("♠ Blackjack")
      .body(
        `**Your hand:** ${handStr(game.playerCards)} (**${playerValue}**)\n**Dealer:** ${cardStr(game.dealerCards[0])} + [Hidden]\n\nBet: **${amount.toLocaleString()}** ${config.emojis.coin}`,
      )
      .buttonRow([
        ui.btn("Hit", `blackjack:hit:${gameId}`, ButtonStyle.Primary),
        ui.btn("Stand", `blackjack:stand:${gameId}`, ButtonStyle.Danger),
      ])
      .footer("Choose hit or stand")
      .build() as any,
  );
}

async function highLowGame(ctx: any, amount: number) {
  await ctx.deferReply({});

  const card1 = generateCard();
  const card2 = generateCard();
  const card1Val = handValue([card1]);
  const card2Val = handValue([card2]);

  const higher = card2Val > card1Val;
  const won = Math.random() < 0.5;

  if (won) await addCoins(ctx.user.id, amount * 2);

  return ctx.editReply(
    ui()
      .color(won ? config.colors.success : config.colors.error)
      .title("📈 Higher or Lower?")
      .body(
        `First card: **${cardStr(card1)}** (${card1Val})\nSecond card: **${cardStr(card2)}** (${card2Val})\n\n` +
        (won
          ? `You guessed correctly! You won **${amount.toLocaleString()}** ${config.emojis.coin}!`
          : `Wrong guess! You lost **${amount.toLocaleString()}** ${config.emojis.coin}.`),
      )
      .build() as any,
  );
}

async function rouletteGame(ctx: any, amount: number) {
  await ctx.deferReply({});

  const colors = ["🔴 Red", "⚫ Black", "🟢 Green", "🟠 Orange", "🟣 Purple", "🟡 Yellow", "🟦 Blue"];
  const spinResult = colors[Math.floor(Math.random() * colors.length)];
  const odds = [1, 1, 3, 1.5, 1.5, 1.5, 1.5];
  const idx = colors.findIndex((c) => c === spinResult);
  const multiplier = odds[idx];

  const won = Math.random() < (1 / 7) * 1.2; // Slightly favorable
  if (won) await addCoins(ctx.user.id, Math.floor(amount * multiplier));

  return ctx.editReply(
    ui()
      .color(won ? config.colors.success : config.colors.error)
      .title("🎡 Roulette")
      .body(
        `Wheel spins...\n**${spinResult}**\n\n` +
        (won
          ? `Lucky spin! You won **${Math.floor(amount * multiplier).toLocaleString()}** ${config.emojis.coin}!`
          : `The wheel didn't favor you. You lost **${amount.toLocaleString()}** ${config.emojis.coin}.`),
      )
      .build() as any,
  );
}

async function diceGame(ctx: any, amount: number) {
  await ctx.deferReply({});

  const roll1 = Math.floor(Math.random() * 6) + 1;
  const roll2 = Math.floor(Math.random() * 6) + 1;
  const total = roll1 + roll2;

  const lucky = [7, 11, 13]; // Lucky totals
  const won = lucky.includes(total);
  if (won) await addCoins(ctx.user.id, amount * 2);

  return ctx.editReply(
    ui()
      .color(won ? config.colors.success : config.colors.error)
      .title("🎲 Dice Roll")
      .body(
        `🎲 ${roll1} + 🎲 ${roll2} = **${total}**\n\n` +
        (won
          ? `Lucky number! You won **${amount.toLocaleString()}** ${config.emojis.coin}!`
          : `No luck. You lost **${amount.toLocaleString()}** ${config.emojis.coin}.`),
      )
      .footer("Lucky numbers: 7, 11, 13")
      .build() as any,
  );
}
