import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { fishingLocations, locationMap } from "@/data/locations";
import { getOrCreateProfile } from "@/modules/fishing/economy";
import { db } from "@/db";
import { fishingProfile } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  ActionRowBuilder,
  ApplicationCommandType,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ComponentType,
  MessageFlags,
} from "discord.js";

function buildLocationEmbed(
  currentId: string,
  playerLevel: number,
) {
  const builder = ui()
    .color(config.colors.default)
    .title("🗺️ Fishing Locations");

  const lines = fishingLocations.map((loc) => {
    const unlocked = playerLevel >= loc.minLevel;
    const active = loc.id === currentId;
    const lock = unlocked ? "" : "🔒 ";
    const marker = active ? " ← **Current**" : "";

    const effectText =
      loc.effects.length > 0
        ? loc.effects
            .map((e) => {
              const pct = Math.round((e.value - 1) * 100);
              const sign = pct >= 0 ? "+" : "";
              const label = e.type
                .replace(/_/g, " ")
                .replace(/\b\w/g, (c) => c.toUpperCase());
              return `${sign}${pct}% ${label}`;
            })
            .join(", ")
        : "No modifiers";

    const exclusiveText =
      loc.exclusiveFish.length > 0
        ? `\n-# Exclusive: ${loc.exclusiveFish.map((f) => `${f.emoji} ${f.name}`).join(", ")}`
        : "";

    return (
      `${lock}${loc.emoji} **${loc.name}** (Lv ${loc.minLevel}+)${marker}\n` +
      `-# ${loc.description}\n` +
      `-# ${effectText}${exclusiveText}`
    );
  });

  builder.text(lines.join("\n\n"));
  builder.footer("Select a location below to start fishing there");

  return builder;
}

export default {
  name: "location",
  description: "View and switch fishing locations",
  type: ApplicationCommandType.ChatInput,
  usage: ["/location"],
  defer: true,
  options: [],
  run: async ({ ctx }) => {
    const profile = await getOrCreateProfile(ctx.user.id);
    const currentId = profile.equippedLocation ?? "pond";

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`location:select:${ctx.user.id}`)
      .setPlaceholder("Choose a fishing spot...")
      .addOptions(
        fishingLocations.map((loc) => {
          const unlocked = profile.level >= loc.minLevel;
          return new StringSelectMenuOptionBuilder()
            .setLabel(
              `${loc.emoji} ${loc.name}${!unlocked ? ` (Lv ${loc.minLevel} required)` : ""}`,
            )
            .setDescription(
              unlocked ? loc.description.slice(0, 100) : `Unlock at level ${loc.minLevel}`,
            )
            .setValue(loc.id)
            .setDefault(loc.id === currentId);
        }),
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    const embed = buildLocationEmbed(currentId, profile.level);
    const message = await ctx.editReply(
      embed.build({ rows: [row] }) as any,
    );

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      filter: (i) => i.user.id === ctx.user.id,
      time: 120_000,
    });

    collector.on("collect", async (interaction) => {
      const selectedId = interaction.values[0];
      const loc = locationMap.get(selectedId);
      if (!loc) return interaction.deferUpdate();

      // Re-fetch profile for latest level
      const freshProfile = await getOrCreateProfile(ctx.user.id);

      if (freshProfile.level < loc.minLevel) {
        await interaction.reply({
          flags: MessageFlags.Ephemeral,
          content: `${config.emojis.cross} You need to be **Level ${loc.minLevel}** to fish at **${loc.name}**. You are Level ${freshProfile.level}.`,
        });
        return;
      }

      // Update equipped location
      await db
        .update(fishingProfile)
        .set({ equippedLocation: selectedId })
        .where(eq(fishingProfile.userId, ctx.user.id));

      const updatedEmbed = buildLocationEmbed(selectedId, freshProfile.level);

      // Rebuild select menu with new default
      const newSelect = new StringSelectMenuBuilder()
        .setCustomId(`location:select:${ctx.user.id}`)
        .setPlaceholder("Choose a fishing spot...")
        .addOptions(
          fishingLocations.map((l) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(
                `${l.emoji} ${l.name}${freshProfile.level < l.minLevel ? ` (Lv ${l.minLevel} required)` : ""}`,
              )
              .setDescription(
                freshProfile.level >= l.minLevel
                  ? l.description.slice(0, 100)
                  : `Unlock at level ${l.minLevel}`,
              )
              .setValue(l.id)
              .setDefault(l.id === selectedId),
          ),
        );

      const newRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(newSelect);

      await interaction.update(
        updatedEmbed.build({ rows: [newRow] }) as any,
      );
    });

    collector.on("end", async () => {
      try {
        await message.edit({ components: [] });
      } catch {}
    });
  },
} as Command;
