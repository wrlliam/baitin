import config from "@/config";
import { ui, ButtonStyle } from "@/ui";
import { Command } from "@/core/typings";
import {
  addCoins,
  subtractCoins,
  getOrCreateProfile,
} from "@/modules/fishing/economy";
import {
  checkBlackjackWinLimit,
  incrementBlackjackWins,
} from "@/modules/fishing/economy_games";
import {
  createGame,
  getGame,
  hitPlayer,
  doubleDown,
  settleGame,
  deleteGame,
  handValue,
  handEmojis,
  dealerHandEmojis,
  handStr,
  LOW_STAKES,
  HIGH_STAKES,
  VIP_STAKES,
  type BlackjackGame,
} from "@/modules/games/blackjack";
import {
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle as DjsButtonStyle,
  ComponentType,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

function gameButtons(gameId: string, canDouble: boolean): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`bj:hit:${gameId}`)
      .setLabel("Hit")
      .setStyle(DjsButtonStyle.Primary)
      .setEmoji("🃏"),
    new ButtonBuilder()
      .setCustomId(`bj:stand:${gameId}`)
      .setLabel("Stand")
      .setStyle(DjsButtonStyle.Danger)
      .setEmoji("✋"),
  );

  if (canDouble) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`bj:double:${gameId}`)
        .setLabel("Double Down")
        .setStyle(DjsButtonStyle.Success)
        .setEmoji("⬆️"),
    );
  }

  return row;
}

function buildGameView(game: BlackjackGame, showDealer: boolean) {
  const playerValue = handValue(game.playerCards);
  const playerHand = handEmojis(game.playerCards);
  const dealerHand = showDealer
    ? handEmojis(game.dealerCards)
    : dealerHandEmojis(game.dealerCards);
  const dealerValue = showDealer
    ? handValue(game.dealerCards)
    : handValue([game.dealerCards[0]]);
  const dealerLabel = showDealer
    ? `(**${handValue(game.dealerCards)}**)`
    : `(**${dealerValue}** + ?)`;

  return (
    `**Your Hand** — ${playerHand}\nValue: **${playerValue}**\n\n` +
    `**Dealer** — ${dealerHand}\n${showDealer ? `Value: **${handValue(game.dealerCards)}**` : `Showing: **${dealerValue}**`}\n\n` +
    `Bet: **${game.amount.toLocaleString()}** ${config.emojis.coin}`
  );
}

function resultColor(result: string): string {
  switch (result) {
    case "blackjack":
    case "win":
      return config.colors.success;
    case "push":
      return config.colors.default;
    default:
      return config.colors.error;
  }
}

function resultTitle(result: string): string {
  switch (result) {
    case "blackjack":
      return `${config.emojis.blackjack} Blackjack!`;
    case "win":
      return `${config.emojis.blackjack} You Win!`;
    case "push":
      return `${config.emojis.blackjack} Push!`;
    case "bust":
      return `${config.emojis.blackjack} Bust!`;
    default:
      return `${config.emojis.blackjack} Dealer Wins`;
  }
}

function resultMessage(result: string, game: BlackjackGame, payout: number): string {
  switch (result) {
    case "blackjack":
      return `Natural blackjack! You win **${payout.toLocaleString()}** ${config.emojis.coin} (2.5× payout)!`;
    case "win":
      return `You beat the dealer! Payout: **${payout.toLocaleString()}** ${config.emojis.coin}.`;
    case "push":
      return `It's a tie! Your **${payout.toLocaleString()}** ${config.emojis.coin} bet is returned.`;
    case "bust":
      return `You went over 21! You lost **${game.amount.toLocaleString()}** ${config.emojis.coin}.`;
    default:
      return `The dealer wins. You lost **${game.amount.toLocaleString()}** ${config.emojis.coin}.`;
  }
}

async function startGame(interaction: any, userId: string, amount: number) {
  const paid = await subtractCoins(userId, amount);
  if (!paid) {
    return interaction.reply({
      ...ui()
        .color(config.colors.error)
        .title(`${config.emojis.cross} Not Enough Coins`)
        .body(`You don't have **${amount.toLocaleString()}** ${config.emojis.coin} to bet.`)
        .build(),
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    } as any);
  }

  const { game, gameId } = createGame(userId, amount);
  const playerValue = handValue(game.playerCards);

  // Natural blackjack check
  if (playerValue === 21) {
    const result = settleGame(game);
    deleteGame(gameId);

    if (result.payout > 0) await addCoins(userId, result.payout);
    if (result.result === "blackjack" || result.result === "win") await incrementBlackjackWins(userId);

    return interaction.reply(
      ui()
        .color(resultColor(result.result))
        .title(resultTitle(result.result))
        .body(buildGameView(game, true) + "\n\n" + resultMessage(result.result, game, result.payout))
        .build() as any,
    );
  }

  // Can double if player has enough coins
  const profile = await getOrCreateProfile(userId);
  const canDouble = profile.coins >= amount;

  const { resource } = await interaction.reply({
    ...ui()
      .color(config.colors.default)
      .title(`${config.emojis.blackjack} Blackjack`)
      .body(buildGameView(game, false))
      .footer("Hit to draw, Stand to hold, Double Down for 2× bet + 1 card")
      .build({ rows: [gameButtons(gameId, canDouble)] }),
    withResponse: true,
  } as any);

  const reply = resource?.message ?? await interaction.fetchReply();

  const collector = reply.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 5 * 60 * 1000,
    filter: (i: any) => i.user.id === userId && i.customId.startsWith("bj:"),
  });

  collector.on("collect", async (i: any) => {
    const [, action] = i.customId.split(":");
    const currentGame = getGame(gameId);

    if (!currentGame) {
      collector.stop("expired");
      return i.reply({
        content: `${config.emojis.cross} Game expired. Start a new one with \`/blackjack\`.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (action === "hit") {
      const newCard = hitPlayer(gameId);
      if (!newCard) return i.deferUpdate();

      const pv = handValue(currentGame.playerCards);

      if (pv > 21) {
        // Bust
        currentGame.settled = true;
        deleteGame(gameId);
        collector.stop("settled");

        return i.update(
          ui()
            .color(config.colors.error)
            .title(resultTitle("bust"))
            .body(buildGameView(currentGame, true) + "\n\n" + resultMessage("bust", currentGame, 0))
            .build() as any,
        );
      }

      if (pv === 21) {
        // Auto-stand on 21
        const result = settleGame(currentGame);
        deleteGame(gameId);
        collector.stop("settled");

        if (result.payout > 0) await addCoins(userId, result.payout);
        if (result.result === "blackjack" || result.result === "win") await incrementBlackjackWins(userId);

        return i.update(
          ui()
            .color(resultColor(result.result))
            .title(resultTitle(result.result))
            .body(buildGameView(currentGame, true) + "\n\n" + resultMessage(result.result, currentGame, result.payout))
            .build() as any,
        );
      }

      // Continue — no more double down after first hit
      return i.update({
        ...ui()
          .color(config.colors.default)
          .title(`${config.emojis.blackjack} Blackjack`)
          .body(buildGameView(currentGame, false))
          .footer("Hit to draw, Stand to hold")
          .build({ rows: [gameButtons(gameId, false)] }),
      } as any);
    }

    if (action === "stand") {
      const result = settleGame(currentGame);
      deleteGame(gameId);
      collector.stop("settled");

      if (result.payout > 0) await addCoins(userId, result.payout);
      if (result.result === "blackjack" || result.result === "win") await incrementBlackjackWins(userId);

      return i.update(
        ui()
          .color(resultColor(result.result))
          .title(resultTitle(result.result))
          .body(buildGameView(currentGame, true) + "\n\n" + resultMessage(result.result, currentGame, result.payout))
          .build() as any,
      );
    }

    if (action === "double") {
      // Deduct extra bet
      const extraPaid = await subtractCoins(userId, currentGame.amount);
      if (!extraPaid) {
        return i.reply({
          content: `${config.emojis.cross} You no longer have enough coins to double down!`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const newCard = doubleDown(gameId);
      if (!newCard) {
        // Refund if double fails
        await addCoins(userId, currentGame.amount);
        return i.reply({
          content: `${config.emojis.cross} Can't double down right now.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      // Auto-settle after double (one card only)
      const result = settleGame(currentGame);
      deleteGame(gameId);
      collector.stop("settled");

      if (result.payout > 0) await addCoins(userId, result.payout);
      if (result.result === "blackjack" || result.result === "win") await incrementBlackjackWins(userId);

      return i.update(
        ui()
          .color(resultColor(result.result))
          .title(resultTitle(result.result))
          .text(`-# Doubled down! Bet: **${currentGame.amount.toLocaleString()}** ${config.emojis.coin}`)
          .body(buildGameView(currentGame, true) + "\n\n" + resultMessage(result.result, currentGame, result.payout))
          .build() as any,
      );
    }
  });

  collector.on("end", async (_: any, reason: string) => {
    if (reason === "settled" || reason === "expired") return;

    // Timeout — forfeit
    const currentGame = getGame(gameId);
    if (currentGame && !currentGame.settled) {
      currentGame.settled = true;
      deleteGame(gameId);
    }

    await reply.edit(
      ui()
        .color(config.colors.default)
        .title(`${config.emojis.blackjack} Blackjack — Timed Out`)
        .body("You didn't respond in time. Your bet was forfeited.")
        .build() as any,
    ).catch(() => {});
  });
}

export default {
  name: "blackjack",
  description: "Play blackjack with custom card emojis!",
  type: ApplicationCommandType.ChatInput,
  usage: ["/blackjack"],
  defer: "none",
  run: async ({ ctx }) => {
    // Check daily win limit
    const { ok: canPlay } = await checkBlackjackWinLimit(ctx.user.id);
    if (!canPlay) {
      return ctx.reply({
        ...ui()
          .color(config.colors.error)
          .title(`${config.emojis.cross} Daily Limit Reached`)
          .body("It looks like you're counting cards \u{1F928}\nYou've hit your 3 win limit for today. Come back tomorrow!")
          .build(),
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      } as any);
    }

    const profile = await getOrCreateProfile(ctx.user.id);

    // Landing page with balance + stakes selection
    const stakesRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("bj:stakes:low")
        .setLabel(`Low Stakes (${LOW_STAKES.min.toLocaleString()}-${LOW_STAKES.max.toLocaleString()})`)
        .setStyle(DjsButtonStyle.Primary)
        .setEmoji("🎰"),
      new ButtonBuilder()
        .setCustomId("bj:stakes:high")
        .setLabel(`High Stakes (${HIGH_STAKES.min.toLocaleString()}-${HIGH_STAKES.max.toLocaleString()})`)
        .setStyle(DjsButtonStyle.Danger)
        .setEmoji("💎"),
      new ButtonBuilder()
        .setCustomId("bj:stakes:vip")
        .setLabel(`VIP (${VIP_STAKES.min.toLocaleString()}-${VIP_STAKES.max.toLocaleString()})`)
        .setStyle(DjsButtonStyle.Success)
        .setEmoji("👑"),
    );

    const { resource } = await ctx.reply({
      ...ui()
        .color(config.colors.default)
        .title(`${config.emojis.blackjack} Blackjack`)
        .body(
          `${config.emojis.coin} **Your Balance:** ${profile.coins.toLocaleString()} coins\n\n` +
          `Choose your stakes to begin. You'll enter your bet amount next.`,
        )
        .divider()
        .text(
          `🎰 **Low Stakes** — ${LOW_STAKES.min.toLocaleString()} to ${LOW_STAKES.max.toLocaleString()} coins\n` +
          `💎 **High Stakes** — ${HIGH_STAKES.min.toLocaleString()} to ${HIGH_STAKES.max.toLocaleString()} coins\n` +
          `👑 **VIP** — ${VIP_STAKES.min.toLocaleString()} to ${VIP_STAKES.max.toLocaleString()} coins`,
        )
        .footer("Beat the dealer to win! Blackjack pays 2.5×")
        .build({ rows: [stakesRow] }),
      withResponse: true,
    } as any);

    const reply = resource?.message ?? await ctx.fetchReply();

    const stakesCollector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60_000,
      max: 1,
      filter: (i: any) => i.user.id === ctx.user.id && i.customId.startsWith("bj:stakes:"),
    });

    stakesCollector.on("collect", async (i: any) => {
      const tier = i.customId === "bj:stakes:vip" ? "vip" : i.customId === "bj:stakes:high" ? "high" : "low";
      const stakes = tier === "vip" ? VIP_STAKES : tier === "high" ? HIGH_STAKES : LOW_STAKES;

      // Show modal for bet amount
      const modal = new ModalBuilder()
        .setCustomId(`bj:modal:${tier}`)
        .setTitle(`${tier === "vip" ? "👑 VIP" : tier === "high" ? "💎 High" : "🎰 Low"} Stakes Blackjack`);

      const betInput = new TextInputBuilder()
        .setCustomId("bet_amount")
        .setLabel(`Bet amount (${stakes.min.toLocaleString()} - ${stakes.max.toLocaleString()})`)
        .setPlaceholder(`Enter a number between ${stakes.min} and ${stakes.max}`)
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(10);

      const row = new ActionRowBuilder<TextInputBuilder>().addComponents(betInput);
      modal.addComponents(row as any);

      await i.showModal(modal);

      // Wait for modal submission
      try {
        const modalSubmit = await i.awaitModalSubmit({
          time: 60_000,
          filter: (m: any) => m.customId === `bj:modal:${tier}` && m.user.id === ctx.user.id,
        });

        const betStr = modalSubmit.fields.getTextInputValue("bet_amount").replace(/,/g, "").trim();
        const amount = parseInt(betStr, 10);

        if (isNaN(amount) || amount < stakes.min || amount > stakes.max) {
          return modalSubmit.reply({
            ...ui()
              .color(config.colors.error)
              .title(`${config.emojis.cross} Invalid Bet`)
              .body(`Enter a number between **${stakes.min.toLocaleString()}** and **${stakes.max.toLocaleString()}**.`)
              .build(),
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
          } as any);
        }

        // Disable stakes buttons
        await reply.edit(
          ui()
            .color(config.colors.default)
            .title(`${config.emojis.blackjack} Blackjack`)
            .body(`Starting game with **${amount.toLocaleString()}** ${config.emojis.coin} bet...`)
            .build() as any,
        ).catch(() => {});

        // Start the game using the modal interaction as the reply context
        await startGame(modalSubmit, ctx.user.id, amount);
      } catch {
        // Modal timed out — silently ignore
      }
    });

    stakesCollector.on("end", async (collected: any) => {
      if (collected.size === 0) {
        await reply.edit(
          ui()
            .color(config.colors.default)
            .title(`${config.emojis.blackjack} Blackjack — Cancelled`)
            .body("You didn't select stakes in time.")
            .build() as any,
        ).catch(() => {});
      }
    });
  },
} as Command;
