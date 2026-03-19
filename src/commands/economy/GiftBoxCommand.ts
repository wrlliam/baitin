import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { allItems } from "@/data";
import { pickRandomItem, giveItem } from "@/modules/fishing/social";
import { getOrCreateProfile } from "@/modules/fishing/economy";
import { redis } from "@/db/redis";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
} from "discord.js";

const GIFTBOX_COOLDOWN = 3600; // 1 hour

export default {
  name: "gift-box",
  description: "Send a mystery gift box to another player!",
  type: ApplicationCommandType.ChatInput,
  usage: ["/gift-box <user>"],
  options: [
    {
      name: "user",
      description: "Who to send the mystery gift to.",
      type: ApplicationCommandOptionType.User,
      required: true,
    },
  ],
  run: async ({ args, ctx }) => {
    const target = args.getUser("user", true);

    if (target.id === ctx.user.id) {
      return ctx.editReply({
        content: `${config.emojis.cross} You can't gift yourself!`,
      });
    }
    if (target.bot) {
      return ctx.editReply({
        content: `${config.emojis.cross} You can't gift a bot!`,
      });
    }

    // Cooldown check
    const cdKey = `giftbox:cd:${ctx.user.id}`;
    const cdVal = await redis.get(cdKey);
    if (cdVal) {
      const expiresAt = parseInt(cdVal);
      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title("⏳ Cooldown")
          .body(`You can send another gift box <t:${Math.floor(expiresAt / 1000)}:R>.`)
          .build() as any,
      );
    }

    await getOrCreateProfile(target.id);

    const randomItem = await pickRandomItem(ctx.user.id);
    if (!randomItem) {
      return ctx.editReply({
        content: `${config.emojis.cross} You don't have any giftable items in your sack!`,
      });
    }

    const result = await giveItem(ctx.user.id, target.id, randomItem.itemId, randomItem.itemType);
    if (!result.success) {
      return ctx.editReply({ content: `${config.emojis.cross} ${result.error}` });
    }

    const item = allItems.get(randomItem.itemId);
    const itemName = item ? `${item.emoji} ${item.name}` : randomItem.itemId;

    // Set cooldown
    const expiresAt = Date.now() + GIFTBOX_COOLDOWN * 1000;
    await redis.send("SETEX", [cdKey, GIFTBOX_COOLDOWN.toString(), expiresAt.toString()]);

    return ctx.editReply(
      ui()
        .color(config.colors.success)
        .title(`${config.emojis.gift} Mystery Gift Box!`)
        .body(
          `**${ctx.user.username}** sent a mystery gift to **${target.username}**!\n\n` +
          `The box contained: **${itemName}**!`,
        )
        .footer("Gift boxes contain a random item from your sack")
        .build() as any,
    );
  },
} as Command;
