import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { subtractCoins, addCoins, getOrCreateProfile } from "@/modules/fishing/economy";
import { resolveDuel, DUEL_CHOICE_EMOJI, DUEL_CHOICE_LABEL, type DuelChoice } from "@/modules/games/duel";
import { incrementQuestProgress } from "@/modules/fishing/quests";
import { redis } from "@/db/redis";
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} from "discord.js";

const DUEL_COOLDOWN = 120; // 2 minutes
const HOUSE_CUT = 0.05;

function choiceRow(prefix: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    (["net", "hook", "bait"] as DuelChoice[]).map((c) =>
      new ButtonBuilder()
        .setCustomId(`${prefix}:${c}`)
        .setLabel(DUEL_CHOICE_LABEL[c])
        .setEmoji(DUEL_CHOICE_EMOJI[c])
        .setStyle(ButtonStyle.Primary),
    ),
  );
}

export default {
  name: "duel",
  description: "Challenge another player to a fishing-themed duel!",
  type: ApplicationCommandType.ChatInput,
  usage: ["/duel <user> <amount>"],
  defer: "none",
  options: [
    {
      name: "user",
      description: "Who to challenge.",
      type: ApplicationCommandOptionType.User,
      required: true,
    },
    {
      name: "amount",
      description: "How many coins to wager (100-50,000).",
      type: ApplicationCommandOptionType.Integer,
      required: true,
      minValue: 100,
      maxValue: 50000,
    },
  ],
  run: async ({ args, ctx, client }) => {
    const target = args.getUser("user", true);
    const amount = args.getInteger("amount", true);

    if (target.id === ctx.user.id) {
      return ctx.reply({
        content: `${config.emojis.cross} You can't duel yourself!`,
        flags: MessageFlags.Ephemeral,
      });
    }
    if (target.bot) {
      return ctx.reply({
        content: `${config.emojis.cross} You can't duel a bot!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // Cooldown check
    for (const userId of [ctx.user.id, target.id]) {
      const cdVal = await redis.get(`duel:cd:${userId}`);
      if (cdVal) {
        const expiresAt = parseInt(cdVal);
        const who = userId === ctx.user.id ? "You're" : `**${target.username}** is`;
        return ctx.reply({
          ...ui()
            .color(config.colors.default)
            .title("⏳ Cooldown")
            .body(`${who} on duel cooldown until <t:${Math.floor(expiresAt / 1000)}:R>.`)
            .build(),
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        } as any);
      }
    }

    // Lock check
    for (const userId of [ctx.user.id, target.id]) {
      const lock = await redis.get(`duel:active:${userId}`);
      if (lock) {
        return ctx.reply({
          content: `${config.emojis.cross} ${userId === ctx.user.id ? "You're" : `**${target.username}** is`} already in a duel!`,
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    // Verify both have enough coins
    const [challengerProfile, targetProfile] = await Promise.all([
      getOrCreateProfile(ctx.user.id),
      getOrCreateProfile(target.id),
    ]);

    if (challengerProfile.coins < amount) {
      return ctx.reply({
        content: `${config.emojis.cross} You don't have **${amount.toLocaleString()}** ${config.emojis.coin}.`,
        flags: MessageFlags.Ephemeral,
      });
    }
    if (targetProfile.coins < amount) {
      return ctx.reply({
        content: `${config.emojis.cross} **${target.username}** doesn't have **${amount.toLocaleString()}** ${config.emojis.coin}.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // Accept/decline row
    const acceptRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("duel:accept").setLabel("Accept").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("duel:decline").setLabel("Decline").setStyle(ButtonStyle.Danger),
    );

    const { resource } = await ctx.reply({
      ...ui()
        .color(config.colors.default)
        .title(`${config.emojis.duel} Duel Challenge!`)
        .body(
          `**${ctx.user.username}** challenges **${target.username}** to a duel for **${amount.toLocaleString()}** ${config.emojis.coin}!\n\n` +
          `**Net** beats **Hook**, **Hook** beats **Bait**, **Bait** beats **Net**.\n` +
          `-# ${target.username}, accept or decline within 30 seconds.`,
        )
        .build({ rows: [acceptRow] }),
      withResponse: true,
    } as any);

    const reply = resource!.message!;

    // Wait for accept/decline
    const acceptCollector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 30_000,
      max: 1,
      filter: (i: any) => i.user.id === target.id && (i.customId === "duel:accept" || i.customId === "duel:decline"),
    });

    acceptCollector.on("collect", async (i: any) => {
      if (i.customId === "duel:decline") {
        return i.update(
          ui()
            .color(config.colors.error)
            .title(`${config.emojis.duel} Duel Declined`)
            .body(`**${target.username}** declined the duel.`)
            .build() as any,
        );
      }

      // Lock both players and deduct coins
      await redis.send("SETEX", [`duel:active:${ctx.user.id}`, "120", "1"]);
      await redis.send("SETEX", [`duel:active:${target.id}`, "120", "1"]);

      const p1Paid = await subtractCoins(ctx.user.id, amount);
      const p2Paid = await subtractCoins(target.id, amount);

      if (!p1Paid || !p2Paid) {
        // Refund
        if (p1Paid) await addCoins(ctx.user.id, amount);
        if (p2Paid) await addCoins(target.id, amount);
        await redis.send("DEL", [`duel:active:${ctx.user.id}`]);
        await redis.send("DEL", [`duel:active:${target.id}`]);
        return i.update({
          content: `${config.emojis.cross} Someone doesn't have enough coins anymore!`,
          components: [],
        });
      }

      // Show choice buttons
      await i.update(
        ui()
          .color(config.colors.default)
          .title(`${config.emojis.duel} Duel in Progress!`)
          .body(
            `**${ctx.user.username}** vs **${target.username}** for **${amount.toLocaleString()}** ${config.emojis.coin}\n\n` +
            `Both players: pick your weapon below!`,
          )
          .build({ rows: [choiceRow("duel:pick")] }) as any,
      );

      // Collect choices
      const choices = new Map<string, DuelChoice>();

      const pickCollector = reply.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 30_000,
        filter: (pi: any) =>
          pi.customId.startsWith("duel:pick:") &&
          (pi.user.id === ctx.user.id || pi.user.id === target.id),
      });

      pickCollector.on("collect", async (pi: any) => {
        const choice = pi.customId.replace("duel:pick:", "") as DuelChoice;
        choices.set(pi.user.id, choice);

        await pi.reply({
          content: `You chose **${DUEL_CHOICE_EMOJI[choice]} ${DUEL_CHOICE_LABEL[choice]}**!`,
          flags: MessageFlags.Ephemeral,
        });

        if (choices.size === 2) {
          pickCollector.stop("both_picked");
        }
      });

      pickCollector.on("end", async (_: any, reason: string) => {
        // Clean up locks
        await redis.send("DEL", [`duel:active:${ctx.user.id}`]);
        await redis.send("DEL", [`duel:active:${target.id}`]);

        const p1Choice = choices.get(ctx.user.id);
        const p2Choice = choices.get(target.id);

        if (!p1Choice || !p2Choice) {
          // Refund both
          await addCoins(ctx.user.id, amount);
          await addCoins(target.id, amount);
          await reply.edit(
            ui()
              .color(config.colors.default)
              .title(`${config.emojis.duel} Duel Timed Out`)
              .body("Both players didn't pick in time. Coins refunded.")
              .build() as any,
          ).catch(() => {});
          return;
        }

        const result = resolveDuel(p1Choice, p2Choice);

        // Set cooldowns
        const cdExpiresAt = Date.now() + DUEL_COOLDOWN * 1000;
        await redis.send("SETEX", [`duel:cd:${ctx.user.id}`, DUEL_COOLDOWN.toString(), cdExpiresAt.toString()]);
        await redis.send("SETEX", [`duel:cd:${target.id}`, DUEL_COOLDOWN.toString(), cdExpiresAt.toString()]);

        const p1Display = `${DUEL_CHOICE_EMOJI[p1Choice]} ${DUEL_CHOICE_LABEL[p1Choice]}`;
        const p2Display = `${DUEL_CHOICE_EMOJI[p2Choice]} ${DUEL_CHOICE_LABEL[p2Choice]}`;

        if (result === "draw") {
          // Full refund on draw
          await addCoins(ctx.user.id, amount);
          await addCoins(target.id, amount);
          await reply.edit(
            ui()
              .color(config.colors.default)
              .title(`${config.emojis.duel} It's a Draw!`)
              .body(
                `**${ctx.user.username}** chose ${p1Display}\n` +
                `**${target.username}** chose ${p2Display}\n\n` +
                `Both players get their coins back!`,
              )
              .build() as any,
          ).catch(() => {});
          return;
        }

        const winnerId = result === "player1" ? ctx.user.id : target.id;
        const winnerName = result === "player1" ? ctx.user.username : target.username;
        const loserName = result === "player1" ? target.username : ctx.user.username;
        const pot = amount * 2;
        const houseCut = Math.floor(pot * HOUSE_CUT);
        const winnings = pot - houseCut;

        await addCoins(winnerId, winnings);
        void incrementQuestProgress(winnerId, "win_duel");

        await reply.edit(
          ui()
            .color(config.colors.success)
            .title(`${config.emojis.duel} ${winnerName} Wins!`)
            .body(
              `**${ctx.user.username}** chose ${p1Display}\n` +
              `**${target.username}** chose ${p2Display}\n\n` +
              `**${winnerName}** wins **${winnings.toLocaleString()}** ${config.emojis.coin}!`,
            )
            .footer(`${houseCut.toLocaleString()} coins house cut (5%)`)
            .build() as any,
        ).catch(() => {});
      });
    });

    acceptCollector.on("end", async (collected: any) => {
      if (collected.size === 0) {
        await reply.edit(
          ui()
            .color(config.colors.default)
            .title(`${config.emojis.duel} Duel Expired`)
            .body(`**${target.username}** didn't respond in time.`)
            .build() as any,
        ).catch(() => {});
      }
    });
  },
} as Command;
