import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { allItems } from "@/data";
import { giveCoins, giveItem } from "@/modules/fishing/social";
import { getOrCreateProfile } from "@/modules/fishing/economy";
import { getInventory } from "@/modules/fishing/inventory";
import { incrementQuestProgress } from "@/modules/fishing/quests";
import { redis } from "@/db/redis";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  MessageFlags,
} from "discord.js";

const GIVE_COOLDOWN = 30; // seconds

export default {
  name: "give",
  description: "Gift coins or items to another player.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/give coins <user> <amount>", "/give item <user> <item>"],
  options: [
    {
      name: "coins",
      description: "Give coins to a player.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "user",
          description: "Who to give coins to.",
          type: ApplicationCommandOptionType.User,
          required: true,
        },
        {
          name: "amount",
          description: "How many coins to give (min 100, 5% tax).",
          type: ApplicationCommandOptionType.Integer,
          required: true,
          minValue: 100,
        },
      ],
    },
    {
      name: "item",
      description: "Give an item to a player.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "user",
          description: "Who to give the item to.",
          type: ApplicationCommandOptionType.User,
          required: true,
        },
        {
          name: "name",
          description: "The item to give.",
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true,
        },
      ],
    },
  ],
  autocomplete: async ({ ctx }) => {
    const focused = ctx.options.getFocused(true);
    const inventory = await getInventory(ctx.user.id);
    const giftable = inventory.filter((i) => !["rod"].includes(i.itemType));

    return ctx.respond(
      giftable
        .map((i) => {
          const item = allItems.get(i.itemId);
          return item
            ? { name: `${item.name} ×${i.quantity}`, value: i.itemId }
            : null;
        })
        .filter(Boolean)
        .filter((c) =>
          c!.name.toLowerCase().includes((focused.value as string).toLowerCase()),
        )
        .slice(0, 25) as { name: string; value: string }[],
    );
  },
  run: async ({ args, ctx }) => {
    const sub = args.getSubcommand();
    const target = args.getUser("user", true);

    if (target.id === ctx.user.id) {
      return ctx.editReply({
        content: `${config.emojis.cross} You can't give to yourself!`,
      });
    }
    if (target.bot) {
      return ctx.editReply({
        content: `${config.emojis.cross} You can't give to a bot!`,
      });
    }

    // Cooldown check
    const cdKey = `give:cd:${ctx.user.id}`;
    const cdVal = await redis.get(cdKey);
    if (cdVal) {
      const expiresAt = parseInt(cdVal);
      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title("⏳ Cooldown")
          .body(`You can give again <t:${Math.floor(expiresAt / 1000)}:R>.`)
          .build() as any,
      );
    }

    await getOrCreateProfile(target.id);

    if (sub === "coins") {
      const amount = args.getInteger("amount", true);
      const result = await giveCoins(ctx.user.id, target.id, amount);

      if (!result.success) {
        return ctx.editReply({
          content: `${config.emojis.cross} ${result.error}`,
        });
      }

      // Set cooldown
      const expiresAt = Date.now() + GIVE_COOLDOWN * 1000;
      await redis.send("SETEX", [cdKey, GIVE_COOLDOWN.toString(), expiresAt.toString()]);

      void incrementQuestProgress(ctx.user.id, "give_coins");

      return ctx.editReply(
        ui()
          .color(config.colors.success)
          .title(`${config.emojis.gift} Gift Sent!`)
          .body(
            `You sent **${result.received.toLocaleString()}** ${config.emojis.coin} to **${target.username}**!\n` +
            `-# ${result.taxed.toLocaleString()} coins deducted as tax (5%)`,
          )
          .build() as any,
      );
    }

    if (sub === "item") {
      const itemId = args.getString("name", true);
      const item = allItems.get(itemId);
      if (!item) {
        return ctx.editReply({ content: `${config.emojis.cross} Unknown item.` });
      }

      const inventory = await getInventory(ctx.user.id);
      const owned = inventory.find((i) => i.itemId === itemId);
      if (!owned) {
        return ctx.editReply({ content: `${config.emojis.cross} You don't have that item.` });
      }

      const result = await giveItem(ctx.user.id, target.id, itemId, owned.itemType);
      if (!result.success) {
        return ctx.editReply({ content: `${config.emojis.cross} ${result.error}` });
      }

      const expiresAt = Date.now() + GIVE_COOLDOWN * 1000;
      await redis.send("SETEX", [cdKey, GIVE_COOLDOWN.toString(), expiresAt.toString()]);

      return ctx.editReply(
        ui()
          .color(config.colors.success)
          .title(`${config.emojis.gift} Gift Sent!`)
          .body(
            `You gave ${item.emoji} **${item.name}** to **${target.username}**!`,
          )
          .build() as any,
      );
    }
  },
} as Command;
