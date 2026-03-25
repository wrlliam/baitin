import config from "@/config";
import { ui, ButtonStyle } from "@/ui";
import { Command } from "@/core/typings";
import {
  addCoins,
  subtractCoins,
} from "@/modules/fishing/economy";
import {
  generateCard,
  handValue,
  cardStr,
  cardEmoji,
} from "@/modules/games/blackjack";
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle as DjsButtonStyle,
  ComponentType,
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
  description: "Play various mini-games to win or lose coins.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/gamble coinflip <amount>", "/gamble highlow <amount>", "/gamble roulette <amount>", "/gamble dice <amount>"],
  defer: "none",
  options: [
    {
      name: "coinflip",
      description: "50/50 chance to double your coins.",
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
    //@ts-ignore
    const subcommand = ctx.options?.getSubcommand();
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
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      } as any);
    }

    switch (subcommand) {
      case "coinflip":
        return flipGame(ctx, amount);
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
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
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
      .title(`${config.emojis.flip} Coin Flip`)
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

async function highLowGame(ctx: any, amount: number) {
  await ctx.deferReply({});

  const card1 = generateCard();
  const card2 = generateCard();
  const card1Val = handValue([card1]);
  const card2Val = handValue([card2]);

  const won = Math.random() < 0.5;

  if (won) await addCoins(ctx.user.id, amount * 2);

  return ctx.editReply(
    ui()
      .color(won ? config.colors.success : config.colors.error)
      .title(`${config.emojis.higher_lower} Higher or Lower?`)
      .body(
        `First card: ${cardEmoji(card1)} **${cardStr(card1)}** (${card1Val})\nSecond card: ${cardEmoji(card2)} **${cardStr(card2)}** (${card2Val})\n\n` +
        (won
          ? `You guessed correctly! You won **${amount.toLocaleString()}** ${config.emojis.coin}!`
          : `Wrong guess! You lost **${amount.toLocaleString()}** ${config.emojis.coin}.`),
      )
      .build() as any,
  );
}

// European roulette: 18 red, 18 black, 1 green (37 slots)
const ROULETTE_SLOTS = 37;
const ROULETTE_RED = 18;
const ROULETTE_BLACK = 18;
// Green = 1

async function rouletteGame(ctx: any, amount: number) {
  // Show color selection buttons (don't defer yet — we need the interaction for buttons)
  const colorRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`roulette:red:${ctx.user.id}`)
      .setLabel("Red (2×)")
      .setStyle(DjsButtonStyle.Danger)
      .setEmoji("🔴"),
    new ButtonBuilder()
      .setCustomId(`roulette:black:${ctx.user.id}`)
      .setLabel("Black (2×)")
      .setStyle(DjsButtonStyle.Secondary)
      .setEmoji("⚫"),
    new ButtonBuilder()
      .setCustomId(`roulette:green:${ctx.user.id}`)
      .setLabel("Green (14×)")
      .setStyle(DjsButtonStyle.Success)
      .setEmoji("🟢"),
  );

  const { resource: pickResource } = await ctx.reply({
    ...ui()
      .color(config.colors.default)
      .title(`${config.emojis.roulette} Roulette — Pick a Color`)
      .body(`Bet: **${amount.toLocaleString()}** ${config.emojis.coin}\n\nChoose a color to bet on.`)
      .footer("🔴 Red or ⚫ Black = 2× payout · 🟢 Green = 14× payout")
      .build({ rows: [colorRow] }),
    withResponse: true,
  } as any);

  const reply = pickResource?.message ?? await ctx.fetchReply();

  let collected: any;
  try {
    collected = await reply.awaitMessageComponent({
      componentType: ComponentType.Button,
      filter: (i: any) => i.user.id === ctx.user.id && i.customId.startsWith("roulette:"),
      time: 30_000,
    });
  } catch {
    // Timed out
    await addCoins(ctx.user.id, amount); // Refund
    try {
      await reply.edit(
        ui()
          .color(config.colors.default)
          .title(`${config.emojis.roulette} Roulette — Cancelled`)
          .body("You didn't pick a color in time. Your bet was refunded.")
          .build() as any,
      );
    } catch {}
    return;
  }

  const choice = collected.customId.split(":")[1] as "red" | "black" | "green";

  // Spin animation
  await collected.update(
    ui()
      .color(config.colors.default)
      .title(`${config.emojis.roulette} Roulette — Spinning...`)
      .body("The wheel is spinning...")
      .build() as any,
  );

  await new Promise((r) => setTimeout(r, 1500));

  // Determine result
  const roll = Math.floor(Math.random() * ROULETTE_SLOTS);
  let resultColor: "red" | "black" | "green";
  if (roll < ROULETTE_RED) resultColor = "red";
  else if (roll < ROULETTE_RED + ROULETTE_BLACK) resultColor = "black";
  else resultColor = "green";

  const colorEmoji = { red: "🔴", black: "⚫", green: "🟢" };
  const colorLabel = { red: "Red", black: "Black", green: "Green" };

  const won = choice === resultColor;
  const multiplier = resultColor === "green" && won ? 14 : won ? 2 : 0;
  const payout = amount * multiplier;

  if (won) await addCoins(ctx.user.id, payout);

  await collected.editReply(
    ui()
      .color(won ? config.colors.success : config.colors.error)
      .title(`${config.emojis.roulette} Roulette`)
      .body(
        `The ball lands on... ${colorEmoji[resultColor]} **${colorLabel[resultColor]}**!\n` +
        `You bet on: ${colorEmoji[choice]} **${colorLabel[choice]}**\n\n` +
        (won
          ? `You won **${payout.toLocaleString()}** ${config.emojis.coin}! (${multiplier}× payout)`
          : `You lost **${amount.toLocaleString()}** ${config.emojis.coin}.`),
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
      .title(`${config.emojis.dice} Dice Roll`)
      .body(
        `${config.emojis.dice} ${roll1} + ${config.emojis.dice} ${roll2} = **${total}**\n\n` +
        (won
          ? `Lucky number! You won **${amount.toLocaleString()}** ${config.emojis.coin}!`
          : `No luck. You lost **${amount.toLocaleString()}** ${config.emojis.coin}.`),
      )
      .footer("Lucky numbers: 7, 11, 13")
      .build() as any,
  );
}
