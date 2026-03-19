import config from "@/config";
import { ui, ButtonStyle } from "@/ui";
import { Command } from "@/core/typings";
import { addCoins, getOrCreateProfile } from "@/modules/fishing/economy";
import { checkCooldown, setCooldown } from "@/modules/fishing/economy_games";
import { incrementQuestProgress } from "@/modules/fishing/quests";
import {
  ApplicationCommandType,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ComponentType,
} from "discord.js";
import type { ChatInputCommandInteraction, Message } from "discord.js";

const COOLDOWN_SECS = 3600; // 1 hour

// ─── Mini-game picker ─────────────────────────────────────────────────────

async function pickRandomGame(
  ctx: ChatInputCommandInteraction,
  userId: string,
  coins: number,
): Promise<boolean> {
  const gameIndex = Math.floor(Math.random() * 3);
  switch (gameIndex) {
    case 0:
      return runMathQuiz(ctx, userId, coins);
    case 1:
      return runMemoryCards(ctx, userId, coins);
    case 2:
      return runSequenceMemory(ctx, userId, coins);
    default:
      return runMathQuiz(ctx, userId, coins);
  }
}

// ─── Math Quiz Mini-Game ──────────────────────────────────────────────────

async function runMathQuiz(
  ctx: ChatInputCommandInteraction,
  userId: string,
  coins: number,
): Promise<boolean> {
  // Generate random problem
  const problemType = Math.floor(Math.random() * 3); // 0: add, 1: sub, 2: mul
  let a: number, b: number, answer: number, op: string;

  if (problemType === 0) {
    // Addition: 1-50 + 1-50
    a = Math.floor(Math.random() * 50) + 1;
    b = Math.floor(Math.random() * 50) + 1;
    answer = a + b;
    op = "+";
  } else if (problemType === 1) {
    // Subtraction: 11-60 - 1-(a-1) = always positive
    a = Math.floor(Math.random() * 50) + 11;
    b = Math.floor(Math.random() * (a - 1)) + 1;
    answer = a - b;
    op = "-";
  } else {
    // Multiplication: 2-11 × 2-10
    a = Math.floor(Math.random() * 10) + 2;
    b = Math.floor(Math.random() * 9) + 2;
    answer = a * b;
    op = "×";
  }

  // Generate 3 wrong answers
  const wrongAnswers: number[] = [];
  while (wrongAnswers.length < 3) {
    const offset = (Math.floor(Math.random() * 19) - 9) || 1; // ±1 to ±9, skip 0
    const wrong = answer + offset;
    if (wrong > 0 && !wrongAnswers.includes(wrong) && wrong !== answer) {
      wrongAnswers.push(wrong);
    }
  }

  // Shuffle all 4 choices
  const choices = [answer, ...wrongAnswers].sort(() => Math.random() - 0.5);

  // Create button row
  const buttons = choices.map((choice) =>
    new ButtonBuilder()
      .setCustomId(`math_${choice}_${userId}`)
      .setLabel(choice.toString())
      .setStyle(ButtonStyle.Primary),
  );
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);

  // Show question
  const msg = await ctx.editReply(
    ui()
      .color(config.colors.default)
      .title(`${config.emojis.math} Math Quiz`)
      .text(`**${a} ${op} ${b} = ?**\n\nYou have 20 seconds to answer.`)
      .build({ rows: [row] }) as any,
  );

  // Collector
  const collector = msg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: (interaction) => interaction.user.id === userId,
    time: 20000,
    max: 1,
  });

  return new Promise((resolve) => {
    collector.on("collect", async (interaction) => {
      const pickedChoice = parseInt(interaction.customId.split("_")[1]);
      const isCorrect = pickedChoice === answer;

      // Disable all buttons and update styles
      const updatedButtons = choices.map((choice) => {
        const btn = new ButtonBuilder()
          .setCustomId(`math_${choice}_${userId}`)
          .setLabel(choice.toString())
          .setDisabled(true);

        if (choice === answer) {
          btn.setStyle(ButtonStyle.Success);
        } else if (choice === pickedChoice) {
          btn.setStyle(ButtonStyle.Danger);
        } else {
          btn.setStyle(ButtonStyle.Secondary);
        }
        return btn;
      });
      const updatedRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        updatedButtons,
      );

      if (isCorrect) {
        await interaction.update(
          ui()
            .color(config.colors.success)
            .title(`${config.emojis.correct} Correct!`)
            .text(
              `You solved **${a} ${op} ${b} = ${answer}** correctly!\n\nYou earned **${coins.toLocaleString()}** ${config.emojis.coin}!`,
            )
            .footer("Cooldown: 1 hour • Baitin • /help")
            .build({ rows: [updatedRow] }) as any,
        );
      } else {
        await interaction.update(
          ui()
            .color(config.colors.error)
            .title(`${config.emojis.wrong} Wrong Answer`)
            .text(
              `The correct answer was **${answer}**. Better luck next time!`,
            )
            .footer("Cooldown: 1 hour • Baitin • /help")
            .build({ rows: [updatedRow] }) as any,
        );
      }

      resolve(isCorrect);
    });

    collector.on("end", async (collected) => {
      if (collected.size === 0) {
        // Timeout
        const timeoutButtons = choices.map((choice) => {
          const btn = new ButtonBuilder()
            .setCustomId(`math_${choice}_${userId}`)
            .setLabel(choice.toString())
            .setStyle(choice === answer ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setDisabled(true);
          return btn;
        });
        const timeoutRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          timeoutButtons,
        );

        await ctx.editReply(
          ui()
            .color(config.colors.warn)
            .title(`${config.emojis.timeout} Time's Up`)
            .text(`The correct answer was **${answer}**. Try again next time!`)
            .footer("Cooldown: 1 hour • Baitin • /help")
            .build({ rows: [timeoutRow] }) as any,
        );
        resolve(false);
      }
    });
  });
}

// ─── Memory Cards Mini-Game ───────────────────────────────────────────────

async function runMemoryCards(
  ctx: ChatInputCommandInteraction,
  userId: string,
  coins: number,
): Promise<boolean> {
  // Emoji pools
  const emojiPool = ["🐟", "🦀", "🐙", "🦑", "🦐", "🐠", "🦦", "🪼"];

  // Pick 3 unique emojis, create 2 of each (6 cards total)
  const selected = [];
  while (selected.length < 3) {
    const emoji = emojiPool[Math.floor(Math.random() * emojiPool.length)];
    if (!selected.includes(emoji)) selected.push(emoji);
  }

  const cards = [...selected, ...selected].sort(() => Math.random() - 0.5);

  // State tracking
  const states: ("hidden" | "flipped" | "matched")[] = cards.map(() => "hidden");
  let firstFlipIdx = -1;
  let locked = false;
  let matchedCount = 0;

  // Create initial button rows (2x3 layout)
  const createRows = () => {
    const row1 = new ActionRowBuilder<ButtonBuilder>();
    const row2 = new ActionRowBuilder<ButtonBuilder>();

    for (let i = 0; i < 6; i++) {
      const state = states[i];
      const emoji =
        state === "hidden"
          ? "🟦"
          : state === "matched"
            ? cards[i]
            : cards[i];
      const label =
        state === "hidden" ? "?" : cards[i];
      const btn = new ButtonBuilder()
        .setCustomId(`wk_card_${i}_${userId}`)
        .setLabel(label)
        .setDisabled(state === "matched" || locked);

      if (state === "hidden") {
        btn.setStyle(ButtonStyle.Secondary);
      } else if (state === "matched") {
        btn.setStyle(ButtonStyle.Success);
      } else {
        btn.setStyle(ButtonStyle.Primary);
      }

      if (i < 3) {
        row1.addComponents(btn);
      } else {
        row2.addComponents(btn);
      }
    }

    return [row1, row2];
  };

  // Show initial message
  let msg = await ctx.editReply(
    ui()
      .color(config.colors.default)
      .title(`${config.emojis.cards} Memory Cards`)
      .text("Match all 3 pairs! You have 60 seconds.")
      .build({ rows: createRows() }) as any,
  );

  // Collector
  const collector = msg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: (interaction) => interaction.user.id === userId,
    time: 60000,
  });

  return new Promise((resolve) => {
    collector.on("collect", async (interaction) => {
      if (locked) {
        await interaction.deferUpdate();
        return;
      }

      const cardIdx = parseInt(interaction.customId.split("_")[2]);

      if (states[cardIdx] === "matched") {
        await interaction.deferUpdate();
        return;
      }

      if (firstFlipIdx === -1) {
        // First flip
        states[cardIdx] = "flipped";
        firstFlipIdx = cardIdx;
        await interaction.update(
          ui()
            .color(config.colors.default)
            .title(`${config.emojis.cards} Memory Cards`)
            .text(`Flipped 1 card. Find its match!`)
            .build({ rows: createRows() }) as any,
        );
      } else {
        // Second flip
        states[cardIdx] = "flipped";

        if (cards[cardIdx] === cards[firstFlipIdx]) {
          // Match!
          states[firstFlipIdx] = "matched";
          states[cardIdx] = "matched";
          matchedCount++;

          if (matchedCount === 3) {
            // All matched!
            collector.stop();
            await interaction.update(
              ui()
                .color(config.colors.success)
                .title(`${config.emojis.correct} You Won!`)
                .text(
                  `You matched all 3 pairs!\n\nYou earned **${coins.toLocaleString()}** ${config.emojis.coin}!`,
                )
                .footer("Cooldown: 1 hour • Baitin • /help")
                .build({ rows: createRows() }) as any,
            );
            resolve(true);
            return;
          }

          await interaction.update(
            ui()
              .color(config.colors.default)
              .title(`${config.emojis.cards} Memory Cards`)
              .text(`Match found! ${matchedCount}/3 pairs matched.`)
              .build({ rows: createRows() }) as any,
          );
          firstFlipIdx = -1;
        } else {
          // No match
          locked = true;

          // Show both flipped briefly
          await interaction.update(
            ui()
              .color(config.colors.default)
              .title(`${config.emojis.cards} Memory Cards`)
              .text("No match... flipping back.")
              .build({ rows: createRows() }) as any,
          );

          // Wait 1.5 seconds, then flip back
          await new Promise((r) => setTimeout(r, 1500));
          states[firstFlipIdx] = "hidden";
          states[cardIdx] = "hidden";
          firstFlipIdx = -1;
          locked = false;

          msg = await ctx.editReply(
            ui()
              .color(config.colors.default)
              .title(`${config.emojis.cards} Memory Cards`)
              .text(`${matchedCount}/3 pairs matched. Keep trying!`)
              .build({ rows: createRows() }) as any,
          );
        }
      }
    });

    collector.on("end", async (collected) => {
      if (matchedCount < 3) {
        // Timeout - reveal all cards
        const revealRows = [];
        const row1 = new ActionRowBuilder<ButtonBuilder>();
        const row2 = new ActionRowBuilder<ButtonBuilder>();

        for (let i = 0; i < 6; i++) {
          const btn = new ButtonBuilder()
            .setCustomId(`wk_card_${i}_${userId}`)
            .setLabel(cards[i])
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true);

          if (i < 3) {
            row1.addComponents(btn);
          } else {
            row2.addComponents(btn);
          }
        }

        await ctx.editReply(
          ui()
            .color(config.colors.warn)
            .title(`${config.emojis.timeout} Time's Up`)
            .text(`You matched **${matchedCount}/3** pairs. Better luck next time!`)
            .footer("Cooldown: 1 hour • Baitin • /help")
            .build({ rows: [row1, row2] }) as any,
        );
        resolve(false);
      }
    });
  });
}

// ─── Sequence Memory Mini-Game ────────────────────────────────────────────

async function runSequenceMemory(
  ctx: ChatInputCommandInteraction,
  userId: string,
  coins: number,
): Promise<boolean> {
  const emojiPool = ["🐟", "🦀", "🐙", "🦑", "🦐", "🐠", "🦦", "🪼", "🐢", "🐚"];

  // Pick 4 unique emojis
  const sequence = [];
  while (sequence.length < 4) {
    const emoji = emojiPool[Math.floor(Math.random() * emojiPool.length)];
    if (!sequence.includes(emoji)) sequence.push(emoji);
  }

  // Phase 1: Show sequence for 5 seconds
  await ctx.editReply(
    ui()
      .color(config.colors.default)
      .title(`${config.emojis.brain} Sequence Memory`)
      .text(
        `**Memorise this sequence:**\n\n${sequence.join("  ")}\n\nYou have 5 seconds to memorise it.`,
      )
      .build() as any,
  );

  await new Promise((r) => setTimeout(r, 5000));

  // Phase 2: Ask about a random position
  const questionIdx = Math.floor(Math.random() * 4);
  const correctEmoji = sequence[questionIdx];

  // Generate 3 wrong choices
  const wrongChoices: string[] = [];
  while (wrongChoices.length < 3) {
    const wrong = emojiPool[Math.floor(Math.random() * emojiPool.length)];
    if (wrong !== correctEmoji && !wrongChoices.includes(wrong)) {
      wrongChoices.push(wrong);
    }
  }

  const choices = [correctEmoji, ...wrongChoices].sort(
    () => Math.random() - 0.5,
  );
  const positionNames = ["1st", "2nd", "3rd", "4th"];

  const buttons = choices.map((choice) =>
    new ButtonBuilder()
      .setCustomId(`seq_${choice}_${userId}`)
      .setLabel(choice)
      .setStyle(ButtonStyle.Primary),
  );
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);

  const msg = await ctx.editReply(
    ui()
      .color(config.colors.default)
      .title(`${config.emojis.brain} Sequence Memory`)
      .text(
        `What was the **${positionNames[questionIdx]}** emoji in the sequence?\n\nYou have 15 seconds.`,
      )
      .build({ rows: [row] }) as any,
  );

  // Collector
  const collector = msg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: (interaction) => interaction.user.id === userId,
    time: 15000,
    max: 1,
  });

  return new Promise((resolve) => {
    collector.on("collect", async (interaction) => {
      const pickedChoice = interaction.customId.split("_")[1];
      const isCorrect = pickedChoice === correctEmoji;

      // Disable all buttons and update styles
      const updatedButtons = choices.map((choice) => {
        const btn = new ButtonBuilder()
          .setCustomId(`seq_${choice}_${userId}`)
          .setLabel(choice)
          .setDisabled(true);

        if (choice === correctEmoji) {
          btn.setStyle(ButtonStyle.Success);
        } else if (choice === pickedChoice) {
          btn.setStyle(ButtonStyle.Danger);
        } else {
          btn.setStyle(ButtonStyle.Secondary);
        }
        return btn;
      });
      const updatedRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        updatedButtons,
      );

      if (isCorrect) {
        await interaction.update(
          ui()
            .color(config.colors.success)
            .title(`${config.emojis.correct} Correct!`)
            .text(
              `The **${positionNames[questionIdx]}** emoji was **${correctEmoji}**!\n\nYou earned **${coins.toLocaleString()}** ${config.emojis.coin}!`,
            )
            .footer("Cooldown: 1 hour • Baitin • /help")
            .build({ rows: [updatedRow] }) as any,
        );
      } else {
        await interaction.update(
          ui()
            .color(config.colors.error)
            .title(`${config.emojis.wrong} Wrong Answer`)
            .text(
              `The **${positionNames[questionIdx]}** emoji was **${correctEmoji}**. Better luck next time!`,
            )
            .footer("Cooldown: 1 hour • Baitin • /help")
            .build({ rows: [updatedRow] }) as any,
        );
      }

      resolve(isCorrect);
    });

    collector.on("end", async (collected) => {
      if (collected.size === 0) {
        // Timeout
        const timeoutButtons = choices.map((choice) => {
          const btn = new ButtonBuilder()
            .setCustomId(`seq_${choice}_${userId}`)
            .setLabel(choice)
            .setStyle(
              choice === correctEmoji ? ButtonStyle.Success : ButtonStyle.Secondary,
            )
            .setDisabled(true);
          return btn;
        });
        const timeoutRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          timeoutButtons,
        );

        await ctx.editReply(
          ui()
            .color(config.colors.warn)
            .title(`${config.emojis.timeout} Time's Up`)
            .text(
              `The **${positionNames[questionIdx]}** emoji was **${correctEmoji}**. Try again next time!`,
            )
            .footer("Cooldown: 1 hour • Baitin • /help")
            .build({ rows: [timeoutRow] }) as any,
        );
        resolve(false);
      }
    });
  });
}

// ─── Main command ─────────────────────────────────────────────────────────

export default {
  name: "work",
  description: "Do some work around the docks and earn coins via a mini-game.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/work"],
  defer: "none",
  options: [],
  run: async ({ ctx }) => {
    const cooldown = await checkCooldown(ctx.user.id, "work");
    if (!cooldown.ok) {
      return ctx.reply({
        ...ui()
          .color(config.colors.default)
          .title(`${config.emojis.work} Still Tired!`)
          .body(
            `You're still recovering from your last shift. Come back <t:${Math.floor(cooldown.expiresAt! / 1000)}:R>.`,
          )
          .build(),
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      } as any);
    }

    await ctx.deferReply({});

    const profile = await getOrCreateProfile(ctx.user.id);
    const coins = Math.min(
      1000,
      100 + Math.floor(Math.random() * 400) + profile.level * 10,
    );

    // Set cooldown immediately (before game)
    await setCooldown(ctx.user.id, "work", COOLDOWN_SECS);

    // Run a random mini-game
    const success = await pickRandomGame(ctx, ctx.user.id, coins);

    // Only add coins if the game was won
    if (success) {
      await addCoins(ctx.user.id, coins);
      void incrementQuestProgress(ctx.user.id, "work");
    }
  },
} as Command;
