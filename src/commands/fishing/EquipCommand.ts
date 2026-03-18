import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { rodItems, baitItems } from "@/data";
import { getOrCreateProfile } from "@/modules/fishing/economy";
import { getInventory } from "@/modules/fishing/inventory";
import { db } from "@/db";
import { fishingProfile } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  MessageFlags,
} from "discord.js";

export default {
  name: "equip",
  description: "Equip a rod or bait.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/equip rod <name>", "/equip bait <name>"],
  options: [
    {
      name: "rod",
      description: "Equip a rod from your sack.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "name",
          description: "The rod to equip.",
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true,
        },
      ],
    },
    {
      name: "bait",
      description: "Equip a bait from your sack.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "name",
          description: "The bait to equip.",
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true,
        },
      ],
    },
  ],
  autocomplete: async ({ ctx }) => {
    const sub = ctx.options.getSubcommand();
    const focused = ctx.options.getFocused(true);
    const inventory = await getInventory(ctx.user.id);

    if (sub === "rod") {
      const owned = inventory.filter((i) => i.itemType === "rod");
      const choices = owned
        .map((i) => {
          const rod = rodItems.get(i.itemId);
          return rod ? { name: rod.name, value: rod.id } : null;
        })
        .filter(Boolean) as { name: string; value: string }[];

      return ctx.respond(
        choices
          .filter((c) =>
            c.name
              .toLowerCase()
              .includes((focused.value as string).toLowerCase()),
          )
          .slice(0, 25),
      );
    }

    if (sub === "bait") {
      const owned = inventory.filter((i) => i.itemType === "bait");
      const choices = owned
        .map((i) => {
          const bait = baitItems.get(i.itemId);
          return bait
            ? { name: `${bait.name} ×${i.quantity}`, value: bait.id }
            : null;
        })
        .filter(Boolean) as { name: string; value: string }[];

      return ctx.respond(
        choices
          .filter((c) =>
            c.name
              .toLowerCase()
              .includes((focused.value as string).toLowerCase()),
          )
          .slice(0, 25),
      );
    }

    return ctx.respond([]);
  },
  run: async ({ args, client, ctx }) => {

    const sub = args.getSubcommand();
    const itemId = args.getString("name", true);
    const inventory = await getInventory(ctx.user.id);

    if (sub === "rod") {
      const rod = rodItems.get(itemId);
      if (!rod) {
        return ctx.editReply({
          content: `${config.emojis.cross} Invalid rod.`,
        });
      }

      const owned = inventory.find(
        (i) => i.itemId === itemId && i.itemType === "rod",
      );
      if (!owned && itemId !== "splintered_twig") {
        return ctx.editReply({
          content: `${config.emojis.cross} You don't own that rod.`,
        });
      }

      await db
        .update(fishingProfile)
        .set({
          equippedRodId: itemId,
          equippedRodDurability: rod.durability === 0 ? null : rod.durability,
        })
        .where(eq(fishingProfile.userId, ctx.user.id));

      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title(`${config.emojis.tick} Rod Equipped`)
          .body(`You equipped **${rod.emoji} ${rod.name}**.`)
          .build() as any,
      );
    }

    if (sub === "bait") {
      const bait = baitItems.get(itemId);
      if (!bait) {
        return ctx.editReply({
          content: `${config.emojis.cross} Invalid bait.`,
        });
      }

      const owned = inventory.find(
        (i) => i.itemId === itemId && i.itemType === "bait",
      );
      if (!owned) {
        return ctx.editReply({
          content: `${config.emojis.cross} You don't own that bait.`,
        });
      }

      await db
        .update(fishingProfile)
        .set({ equippedBaitId: itemId })
        .where(eq(fishingProfile.userId, ctx.user.id));

      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title(`${config.emojis.tick} Bait Equipped`)
          .body(`You equipped **${bait.emoji} ${bait.name}**.`)
          .build() as any,
      );
    }
  },
} as Command;
