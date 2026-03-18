import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { addCoins } from "@/modules/fishing/economy";
import { checkCooldown, setCooldown } from "@/modules/fishing/economy_games";
import {
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} from "discord.js";

const COOLDOWN_SECS = 1800; // 30 minutes

const LOCATIONS = [
  "Under the Dock",
  "Old Shipwreck",
  "Bait Shack",
  "The Reef",
  "Harbor Master's Office",
  "Kelp Forest",
  "Abandoned Trawler",
  "Sandy Cove",
  "The Lighthouse",
  "Fisherman's Hut",
  "Coral Beds",
  "The Pier",
];

const EMPTY_FINDS = [
  "You searched around but found nothing worth taking.",
  "Just some old rope and seaweed.",
  "A crab nipped your finger. Nothing else.",
  "Empty. Someone got here first.",
  "You found an old boot. Not exactly a treasure.",
];

export default {
  name: "search",
  description: "Search locations around the docks for hidden coins.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/search"],
  options: [],
  run: async ({ ctx }) => {

    const cooldown = await checkCooldown(ctx.user.id, "search");
    if (!cooldown.ok) {
      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title("🔍 Already Searched")
          .body(
            `You've already searched the area recently. Try again <t:${Math.floor(cooldown.expiresAt! / 1000)}:R>.`,
          )
          .build() as any,
      );
    }

    const shuffled = [...LOCATIONS].sort(() => Math.random() - 0.5);
    const chosen = shuffled.slice(0, 3);
    const winnerIndex = Math.floor(Math.random() * 3);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      chosen.map((loc, i) =>
        new ButtonBuilder()
          .setCustomId(`search_loc_${i}`)
          .setLabel(loc)
          .setStyle(ButtonStyle.Secondary),
      ),
    );

    const pickPayload = ui()
      .color(config.colors.default)
      .title("🔍 Where Do You Search?")
      .body(
        "Pick a location to search. One of them might have something valuable...",
      )
      .build({ rows: [row] });

    const message = await ctx.editReply(pickPayload as any);

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === ctx.user.id,
      time: 30_000,
      max: 1,
    });

    collector.on("collect", async (interaction) => {
      const idx = parseInt(interaction.customId.replace("search_loc_", ""));
      const location = chosen[idx];

      await setCooldown(ctx.user.id, "search", COOLDOWN_SECS);

      if (idx === winnerIndex) {
        const coins = 50 + Math.floor(Math.random() * 251);
        await addCoins(ctx.user.id, coins);
        await interaction.update(
          ui()
            .color(config.colors.default)
            .title(`🔍 Found Something at ${location}!`)
            .body(
              `You rummaged around and discovered a hidden stash!\n\nYou found **${coins.toLocaleString()}** ${config.emojis.coin}.`,
            )
            .footer("Cooldown: 30 minutes • Baitin • /help")
            .build() as any,
        );
      } else {
        const flavor =
          EMPTY_FINDS[Math.floor(Math.random() * EMPTY_FINDS.length)];
        await interaction.update(
          ui()
            .color(config.colors.default)
            .title(`🔍 Nothing at ${location}`)
            .body(flavor)
            .footer("Cooldown: 30 minutes • Baitin • /help")
            .build() as any,
        );
      }
    });

    collector.on("end", async (collected) => {
      if (collected.size === 0) {
        try {
          await message.edit({ components: [] });
        } catch {}
      }
    });
  },
} as Command;
