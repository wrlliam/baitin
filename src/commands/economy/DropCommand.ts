import config from "@/config";
import { ui, btn } from "@/ui";
import { Command } from "@/core/typings";
import { subtractCoins, addCoins } from "@/modules/fishing/economy";
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

const DROP_COOLDOWN = 300; // 5 minutes
const DROP_TIMEOUT = 30_000; // 30 seconds

export default {
  name: "drop",
  description: "Drop coins in the channel for someone to grab!",
  type: ApplicationCommandType.ChatInput,
  usage: ["/drop <amount>"],
  defer: "none",
  options: [
    {
      name: "amount",
      description: "How many coins to drop (100-10,000).",
      type: ApplicationCommandOptionType.Integer,
      required: true,
      minValue: 100,
      maxValue: 10000,
    },
  ],
  run: async ({ args, ctx }) => {
    const amount = args.getInteger("amount", true);

    // Cooldown check
    const cdKey = `drop:cd:${ctx.user.id}`;
    const cdVal = await redis.get(cdKey);
    if (cdVal) {
      const expiresAt = parseInt(cdVal);
      return ctx.reply({
        ...ui()
          .color(config.colors.default)
          .title("⏳ Cooldown")
          .body(`You can drop coins again <t:${Math.floor(expiresAt / 1000)}:R>.`)
          .build(),
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      } as any);
    }

    const paid = await subtractCoins(ctx.user.id, amount);
    if (!paid) {
      return ctx.reply({
        ...ui()
          .color(config.colors.default)
          .title(`${config.emojis.cross} Not Enough Coins`)
          .body(`You don't have **${amount.toLocaleString()}** ${config.emojis.coin} to drop.`)
          .build(),
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      } as any);
    }

    // Set cooldown
    const expiresAt = Date.now() + DROP_COOLDOWN * 1000;
    await redis.send("SETEX", [cdKey, DROP_COOLDOWN.toString(), expiresAt.toString()]);

    const grabRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("drop:grab")
        .setLabel(`Grab ${amount.toLocaleString()} coins!`)
        .setStyle(ButtonStyle.Success)
        .setEmoji("💰"),
    );

    const { resource } = await ctx.reply({
      ...ui()
        .color(config.colors.success)
        .title(`${config.emojis.drop} Coin Drop!`)
        .body(
          `**${ctx.user.username}** dropped **${amount.toLocaleString()}** ${config.emojis.coin} in the channel!\n` +
          `Be the first to grab them! Expires <t:${Math.floor((Date.now() + DROP_TIMEOUT) / 1000)}:R>.`,
        )
        .build({ rows: [grabRow] }),
      withResponse: true,
    } as any);

    const reply = resource!.message!;

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: DROP_TIMEOUT,
      max: 1,
      filter: (i: any) => i.customId === "drop:grab" && i.user.id !== ctx.user.id,
    });

    collector.on("collect", async (i: any) => {
      await addCoins(i.user.id, amount);

      await i.update(
        ui()
          .color(config.colors.success)
          .title(`${config.emojis.drop} Coin Drop — Claimed!`)
          .body(
            `**${i.user.username}** grabbed **${amount.toLocaleString()}** ${config.emojis.coin} dropped by **${ctx.user.username}**!`,
          )
          .build() as any,
      );
    });

    collector.on("end", async (collected: any) => {
      if (collected.size === 0) {
        // Refund dropper
        await addCoins(ctx.user.id, amount);

        await reply.edit(
          ui()
            .color(config.colors.default)
            .title(`${config.emojis.drop} Coin Drop — Expired`)
            .body(
              `Nobody grabbed the **${amount.toLocaleString()}** ${config.emojis.coin}. Coins returned to **${ctx.user.username}**.`,
            )
            .build() as any,
        ).catch(() => {});
      }
    });
  },
} as Command;
