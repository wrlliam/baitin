import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { getOrCreateProfile, subtractGems } from "@/modules/fishing/economy";
import { db } from "@/db";
import { fishingProfile, fishingInventory, hut, hutInventory, playerUpgrades, eggIncubator } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} from "discord.js";

const PRESTIGE_MIN_LEVEL = 50;
const PRESTIGE_GEM_COST = 500;

export default {
  name: "prestige",
  description: "Reset your progress for permanent multiplier bonuses",
  type: ApplicationCommandType.ChatInput,
  usage: ["/prestige"],
  defer: true,
  options: [],
  run: async ({ ctx }) => {
    const profile = await getOrCreateProfile(ctx.user.id);
    const currentPrestige = profile.prestigeLevel ?? 0;
    const nextPrestige = currentPrestige + 1;

    // Check requirements
    if (profile.level < PRESTIGE_MIN_LEVEL) {
      return ctx.editReply(
        ui()
          .color(config.colors.error)
          .title("⭐ Prestige")
          .text(
            `You need to be **Level ${PRESTIGE_MIN_LEVEL}** to prestige.\n` +
              `You are currently Level **${profile.level}**.`,
          )
          .build() as any,
      );
    }

    if (profile.gems < PRESTIGE_GEM_COST) {
      return ctx.editReply(
        ui()
          .color(config.colors.error)
          .title("⭐ Prestige")
          .text(
            `You need **${PRESTIGE_GEM_COST}** ${config.emojis.gem} gems to prestige.\n` +
              `You currently have **${profile.gems}** ${config.emojis.gem}.`,
          )
          .build() as any,
      );
    }

    // Show confirmation
    const xpBonus = nextPrestige * 5;
    const coinBonus = nextPrestige * 3;

    const confirmEmbed = ui()
      .color(config.colors.warn)
      .title(`⭐ Prestige to Level ${nextPrestige}`)
      .text(
        `**Cost:** ${PRESTIGE_GEM_COST} ${config.emojis.gem}\n\n` +
          `**Permanent Bonuses:**\n` +
          `📖 +${xpBonus}% XP\n` +
          `💰 +${coinBonus}% Coins\n\n` +
          `**What Resets:**\n` +
          `• Level → 1, XP → 0, Coins → 0\n` +
          `• Rod → Splintered Twig, Bait → None\n` +
          `• Inventory cleared, Hut removed\n` +
          `• Upgrades reset, Streak → 0\n\n` +
          `**What Stays:**\n` +
          `• Gems (minus cost), Reputation\n` +
          `• Achievements, Almanac, Titles\n` +
          `• Prestige level & cosmetics`,
      );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`prestige:confirm:${ctx.user.id}`)
        .setLabel("Confirm Prestige")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`prestige:cancel:${ctx.user.id}`)
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Secondary),
    );

    const message = await ctx.editReply(
      confirmEmbed.build({ rows: [row] }) as any,
    );

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === ctx.user.id,
      time: 60_000,
      max: 1,
    });

    collector.on("collect", async (interaction) => {
      if (interaction.customId === `prestige:cancel:${ctx.user.id}`) {
        await interaction.update(
          ui()
            .color(config.colors.default)
            .title("⭐ Prestige Cancelled")
            .text("Your progress remains intact.")
            .build({ rows: [] }) as any,
        );
        return;
      }

      if (interaction.customId === `prestige:confirm:${ctx.user.id}`) {
        // Re-check requirements (in case state changed)
        const freshProfile = await getOrCreateProfile(ctx.user.id);
        if (freshProfile.level < PRESTIGE_MIN_LEVEL || freshProfile.gems < PRESTIGE_GEM_COST) {
          await interaction.update(
            ui()
              .color(config.colors.error)
              .title("⭐ Prestige Failed")
              .text("You no longer meet the requirements.")
              .build({ rows: [] }) as any,
          );
          return;
        }

        // Deduct gems
        const paid = await subtractGems(ctx.user.id, PRESTIGE_GEM_COST);
        if (!paid) {
          await interaction.update(
            ui()
              .color(config.colors.error)
              .title("⭐ Prestige Failed")
              .text("Not enough gems.")
              .build({ rows: [] }) as any,
          );
          return;
        }

        // Reset profile fields
        await db
          .update(fishingProfile)
          .set({
            level: 1,
            xp: 0,
            coins: 0,
            equippedRodId: "splintered_twig",
            equippedBaitId: null,
            preferredBaitId: null,
            equippedRodDurability: null,
            equippedPets: [],
            totalCatches: 0,
            currentStreak: 0,
            lastFishDate: null,
            sackLevel: 1,
            hutOwned: false,
            prestigeLevel: nextPrestige,
            prestigedAt: new Date(),
            equippedLocation: "pond",
            battlepassTier: 0,
            battlepassXp: 0,
            battlepassClaimed: [],
          })
          .where(eq(fishingProfile.userId, ctx.user.id));

        // Clear inventory
        await db
          .delete(fishingInventory)
          .where(eq(fishingInventory.userId, ctx.user.id));

        // Clear hut + hut inventory
        const hutRows = await db.select().from(hut).where(eq(hut.userId, ctx.user.id));
        if (hutRows.length > 0) {
          await db.delete(hutInventory).where(eq(hutInventory.hutId, hutRows[0].id));
          await db.delete(hut).where(eq(hut.userId, ctx.user.id));
        }

        // Clear upgrades
        await db
          .delete(playerUpgrades)
          .where(eq(playerUpgrades.userId, ctx.user.id));

        // Clear incubators
        await db
          .delete(eggIncubator)
          .where(eq(eggIncubator.userId, ctx.user.id));

        await interaction.update(
          ui()
            .color(config.colors.success)
            .title(`⭐ Prestige ${nextPrestige} Achieved!`)
            .text(
              `Congratulations! You are now **Prestige ${nextPrestige}**.\n\n` +
                `**Permanent Bonuses:**\n` +
                `📖 +${xpBonus}% XP on all catches\n` +
                `💰 +${coinBonus}% Coins on all catches\n\n` +
                `Your journey begins anew. Good luck, angler!`,
            )
            .build({ rows: [] }) as any,
        );
      }
    });

    collector.on("end", async (_, reason) => {
      if (reason === "time") {
        try {
          await message.edit(
            ui()
              .color(config.colors.default)
              .title("⭐ Prestige Expired")
              .text("Confirmation timed out.")
              .build({ rows: [] }) as any,
          );
        } catch {}
      }
    });
  },
} as Command;
