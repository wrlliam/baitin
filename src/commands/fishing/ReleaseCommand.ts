import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { allItems, fishItems } from "@/data";
import { getInventory, removeItem } from "@/modules/fishing/inventory";
import { getOrCreateProfile } from "@/modules/fishing/economy";
import { db } from "@/db";
import { fishingProfile } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
} from "discord.js";

export default {
  name: "release",
  description: "Release a fish back into the water for XP.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/release <fish>"],
  options: [
    {
      name: "fish",
      description: "The fish to release.",
      type: ApplicationCommandOptionType.String,
      required: true,
      autocomplete: true,
    },
  ],
  autocomplete: async ({ ctx }) => {
    const focused = ctx.options.getFocused(true);
    const inventory = await getInventory(ctx.user.id);
    const ownedFish = inventory.filter((i) => i.itemType === "fish");

    return ctx.respond(
      ownedFish
        .map((i) => {
          const fish = fishItems.get(i.itemId);
          return fish
            ? {
                name: `${fish.emoji} ${fish.name} x${i.quantity}`,
                value: i.itemId,
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
  run: async ({ args, ctx }) => {
    const fishId = args.getString("fish", true);
    const fish = fishItems.get(fishId);

    if (!fish) {
      return ctx.editReply({
        content: `${config.emojis.cross} Unknown fish.`,
      });
    }

    const removed = await removeItem(ctx.user.id, fishId, 1);
    if (!removed) {
      return ctx.editReply({
        content: `${config.emojis.cross} You don't have that fish in your sack.`,
      });
    }

    const xpGained = Math.floor(fish.xp * 0.5);

    // Add XP without incrementing totalCatches
    const profile = await getOrCreateProfile(ctx.user.id);
    const newXp = profile.xp + xpGained;
    const newLevel = Math.floor(newXp / config.xpPerLevel) + 1;

    await db
      .update(fishingProfile)
      .set({ xp: newXp, level: newLevel })
      .where(eq(fishingProfile.userId, ctx.user.id));

    return ctx.editReply(
      ui()
        .color(config.colors.default)
        .title(`${config.emojis.release} Released!`)
        .body(
          `Released ${fish.emoji} **${fish.name}** back into the water. *(+${xpGained} XP)*`,
        )
        .build() as any,
    );
  },
} as Command;
