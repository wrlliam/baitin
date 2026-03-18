import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { potionItems, rodItems } from "@/data";
import { getInventory, removeItem } from "@/modules/fishing/inventory";
import { addBuff } from "@/modules/fishing/buffs";
import { getOrCreateProfile } from "@/modules/fishing/economy";
import { db } from "@/db";
import { fishingProfile } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  MessageFlags,
} from "discord.js";

export default {
  name: "use",
  description: "Use a potion from your sack.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/use <potion>"],
  options: [
    {
      name: "potion",
      description: "The potion to use.",
      type: ApplicationCommandOptionType.String,
      required: true,
      autocomplete: true,
    },
  ],
  autocomplete: async ({ ctx }) => {
    const focused = ctx.options.getFocused(true);
    const inventory = await getInventory(ctx.user.id);
    const potions = inventory.filter((i) => i.itemType === "misc");

    return ctx.respond(
      potions
        .map((i) => {
          const potion = potionItems.get(i.itemId);
          return potion
            ? {
                name: `${potion.emoji} ${potion.name} ×${i.quantity}`,
                value: potion.id,
              }
            : null;
        })
        .filter(Boolean)
        .filter((c) =>
          c!.name
            .toLowerCase()
            .includes((focused.value as string).toLowerCase()),
        )
        .slice(0, 25) as { name: string; value: string }[],
    );
  },
  run: async ({ args, client, ctx }) => {
    await ctx.deferReply({ flags: MessageFlags.Ephemeral });

    const potionId = args.getString("potion", true);
    const potion = potionItems.get(potionId);
    if (!potion) {
      return ctx.editReply({
        content: `${config.emojis.cross} Unknown potion.`,
      });
    }

    if (potionId === "hut_permit") {
      return ctx.editReply({
        content: `${config.emojis.cross} The Fishing Hut Permit cannot be used — it's automatically applied when purchased from the shop.`,
      });
    }

    if (potionId === "rod_repair_kit") {
      const profile = await getOrCreateProfile(ctx.user.id);
      const rod = rodItems.get(profile.equippedRodId ?? "splintered_twig");
      if (!rod || rod.durability === 0) {
        return ctx.editReply({
          content: `${config.emojis.cross} Your equipped rod (**${rod?.name ?? "Splintered Twig"}**) is indestructible — no repair needed!`,
        });
      }

      const removed = await removeItem(ctx.user.id, potionId, 1);
      if (!removed) {
        return ctx.editReply({
          content: `${config.emojis.cross} You don't have a Rod Repair Kit.`,
        });
      }

      await db
        .update(fishingProfile)
        .set({ equippedRodDurability: rod.durability })
        .where(eq(fishingProfile.userId, ctx.user.id));

      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title("🔧 Rod Repaired!")
          .body(
            `Your **${rod.emoji} ${rod.name}** has been fully restored to **${rod.durability}** durability.`,
          )
          .build() as any,
      );
    }

    const removed = await removeItem(ctx.user.id, potionId, 1);
    if (!removed) {
      return ctx.editReply({
        content: `${config.emojis.cross} You don't have that potion.`,
      });
    }

    await addBuff(ctx.user.id, potion.effects);

    const effectLines = potion.effects.map((e) => {
      const sign = e.amount >= 0 ? "+" : "";
      return `**${e.type.replace(/_/g, " ")}**: ${sign}${Math.round(e.amount * 100)}% for ${e.durationMinutes} minutes`;
    });

    return ctx.editReply(
      ui()
        .color(config.colors.default)
        .title(`${potion.emoji} Used ${potion.name}!`)
        .body(effectLines.join("\n"))
        .footer("Buffs shown in /profile")
        .build() as any,
    );
  },
} as Command;
