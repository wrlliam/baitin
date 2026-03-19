import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { subtractCoins, addCoins, getOrCreateProfile } from "@/modules/fishing/economy";
import { runFishOffRound, scoreFishOff, type FishOffRound } from "@/modules/fishing/fishoff";
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

const FISHOFF_COOLDOWN = 300; // 5 minutes
const HOUSE_CUT = 0.05;
const MIN_LEVEL = 5;

export default {
  name: "fish-off",
  description: "Challenge another player to a competitive fishing duel!",
  type: ApplicationCommandType.ChatInput,
  usage: ["/fish-off <user> <bet>"],
  defer: "none",
  options: [
    {
      name: "user",
      description: "Who to challenge.",
      type: ApplicationCommandOptionType.User,
      required: true,
    },
    {
      name: "bet",
      description: "How many coins to wager (500-25,000).",
      type: ApplicationCommandOptionType.Integer,
      required: true,
      minValue: 500,
      maxValue: 25000,
    },
  ],
  run: async ({ args, ctx }) => {
    const target = args.getUser("user", true);
    const bet = args.getInteger("bet", true);

    if (target.id === ctx.user.id) {
      return ctx.reply({ content: `${config.emojis.cross} You can't fish-off yourself!`, flags: MessageFlags.Ephemeral });
    }
    if (target.bot) {
      return ctx.reply({ content: `${config.emojis.cross} You can't fish-off a bot!`, flags: MessageFlags.Ephemeral });
    }

    // Cooldown
    for (const userId of [ctx.user.id, target.id]) {
      const cdVal = await redis.get(`fishoff:cd:${userId}`);
      if (cdVal) {
        const expiresAt = parseInt(cdVal);
        const who = userId === ctx.user.id ? "You're" : `**${target.username}** is`;
        return ctx.reply({
          ...ui()
            .color(config.colors.default)
            .title("⏳ Cooldown")
            .body(`${who} on fish-off cooldown until <t:${Math.floor(expiresAt / 1000)}:R>.`)
            .build(),
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        } as any);
      }
    }

    // Level check
    const [p1Profile, p2Profile] = await Promise.all([
      getOrCreateProfile(ctx.user.id),
      getOrCreateProfile(target.id),
    ]);

    if (p1Profile.level < MIN_LEVEL) {
      return ctx.reply({ content: `${config.emojis.cross} You need to be level ${MIN_LEVEL}+ to fish-off!`, flags: MessageFlags.Ephemeral });
    }
    if (p2Profile.level < MIN_LEVEL) {
      return ctx.reply({ content: `${config.emojis.cross} **${target.username}** needs to be level ${MIN_LEVEL}+ to fish-off!`, flags: MessageFlags.Ephemeral });
    }
    if (p1Profile.coins < bet) {
      return ctx.reply({ content: `${config.emojis.cross} You don't have enough coins.`, flags: MessageFlags.Ephemeral });
    }
    if (p2Profile.coins < bet) {
      return ctx.reply({ content: `${config.emojis.cross} **${target.username}** doesn't have enough coins.`, flags: MessageFlags.Ephemeral });
    }

    const acceptRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("fishoff:accept").setLabel("Accept").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("fishoff:decline").setLabel("Decline").setStyle(ButtonStyle.Danger),
    );

    const { resource } = await ctx.reply({
      ...ui()
        .color(config.colors.default)
        .title(`${config.emojis.fishoff} Fish-Off Challenge!`)
        .body(
          `**${ctx.user.username}** challenges **${target.username}** to a fish-off for **${bet.toLocaleString()}** ${config.emojis.coin}!\n\n` +
          `3 rounds of fishing — highest total catch value wins!`,
        )
        .build({ rows: [acceptRow] }),
      withResponse: true,
    } as any);

    const reply = resource!.message!;

    const acceptCollector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 30_000,
      max: 1,
      filter: (i: any) => i.user.id === target.id,
    });

    acceptCollector.on("collect", async (i: any) => {
      if (i.customId === "fishoff:decline") {
        return i.update(
          ui()
            .color(config.colors.error)
            .title(`${config.emojis.fishoff} Fish-Off Declined`)
            .body(`**${target.username}** declined the challenge.`)
            .build() as any,
        );
      }

      // Deduct coins
      const p1Paid = await subtractCoins(ctx.user.id, bet);
      const p2Paid = await subtractCoins(target.id, bet);

      if (!p1Paid || !p2Paid) {
        if (p1Paid) await addCoins(ctx.user.id, bet);
        if (p2Paid) await addCoins(target.id, bet);
        return i.update({
          content: `${config.emojis.cross} Someone doesn't have enough coins anymore!`,
          components: [],
        });
      }

      // Set cooldowns
      const cdExpiresAt = Date.now() + FISHOFF_COOLDOWN * 1000;
      await redis.send("SETEX", [`fishoff:cd:${ctx.user.id}`, FISHOFF_COOLDOWN.toString(), cdExpiresAt.toString()]);
      await redis.send("SETEX", [`fishoff:cd:${target.id}`, FISHOFF_COOLDOWN.toString(), cdExpiresAt.toString()]);

      // Run 3 rounds
      await i.update(
        ui()
          .color(config.colors.default)
          .title(`${config.emojis.fishoff} Fish-Off in Progress...`)
          .body(`**${ctx.user.username}** vs **${target.username}** — casting lines...`)
          .build() as any,
      );

      const rounds: FishOffRound[] = [];
      const roundLines: string[] = [];

      for (let r = 0; r < 3; r++) {
        const round = await runFishOffRound(ctx.user.id, target.id);
        rounds.push(round);

        const p1Catch = round.p1Result.item;
        const p2Catch = round.p2Result.item;

        roundLines.push(
          `**Round ${r + 1}**\n` +
          `${p1Catch.emoji} ${p1Catch.name} (${p1Catch.price} ${config.emojis.coin}) vs ` +
          `${p2Catch.emoji} ${p2Catch.name} (${p2Catch.price} ${config.emojis.coin})`,
        );
      }

      const { p1Total, p2Total, winner } = scoreFishOff(rounds);
      const pot = bet * 2;
      const houseCut = Math.floor(pot * HOUSE_CUT);
      const winnings = pot - houseCut;

      let resultText: string;

      if (winner === "draw") {
        await addCoins(ctx.user.id, bet);
        await addCoins(target.id, bet);
        resultText = `It's a **draw**! Both players get their coins back.`;
      } else {
        const winnerId = winner === "player1" ? ctx.user.id : target.id;
        const winnerName = winner === "player1" ? ctx.user.username : target.username;
        await addCoins(winnerId, winnings);
        resultText = `**${winnerName}** wins **${winnings.toLocaleString()}** ${config.emojis.coin}!`;
      }

      await reply.edit(
        ui()
          .color(winner === "draw" ? config.colors.default : config.colors.success)
          .title(`${config.emojis.fishoff} Fish-Off Results`)
          .body(
            roundLines.join("\n\n") + "\n\n" +
            `**Total:** ${ctx.user.username}: ${p1Total.toLocaleString()} ${config.emojis.coin} vs ${target.username}: ${p2Total.toLocaleString()} ${config.emojis.coin}\n\n` +
            resultText,
          )
          .footer(winner !== "draw" ? `${houseCut.toLocaleString()} coins house cut (5%)` : "")
          .build() as any,
      ).catch(() => {});
    });

    acceptCollector.on("end", async (collected: any) => {
      if (collected.size === 0) {
        await reply.edit(
          ui()
            .color(config.colors.default)
            .title(`${config.emojis.fishoff} Fish-Off Expired`)
            .body(`**${target.username}** didn't respond in time.`)
            .build() as any,
        ).catch(() => {});
      }
    });
  },
} as Command;
