import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { upgrades, upgradeMap, type UpgradeDef } from "@/data/upgrades";
import { getOrCreateProfile, subtractCoins } from "@/modules/fishing/economy";
import { getOrCreateUpgrades, setUpgradeField } from "@/modules/fishing/upgrades";
import {
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

function getUpgradePrice(def: UpgradeDef, currentTier: number): number {
  return typeof def.price === "function" ? def.price(currentTier) : def.price;
}

function getCurrentTier(upgData: any, id: string): number {
  switch (id) {
    case "auto_sell": return upgData.autoSellEnabled ? 1 : 0;
    case "multi_cast": return upgData.multiCastTier;
    case "auto_join_tournament": return upgData.autoJoinTournament ? 1 : 0;
    case "deep_sea_sonar": return (upgData.deepSeaSonarRarities?.length > 0 || false) ? 1 : 0;
    case "bait_compressor": return upgData.baitCompressor ? 1 : 0;
    case "tackle_box": return upgData.tackleBoxLevel;
    case "chum_streamer": return upgData.chumStreamer ? 1 : 0;
    case "tax_haven": return upgData.taxHavenLicense ? 1 : 0;
    case "high_tension_line": return upgData.highTensionLine ? 1 : 0;
    default: return 0;
  }
}

function isMaxed(def: UpgradeDef, currentTier: number): boolean {
  return currentTier >= def.maxTier;
}

function buildUpgradesView(upgData: any, userId: string) {
  const builder = ui()
    .color(config.colors.default)
    .title("⬆️ Profile Upgrades")
    .text("Permanent upgrades that enhance your fishing experience.")
    .divider();

  for (const def of upgrades) {
    const tier = getCurrentTier(upgData, def.id);
    const maxed = isMaxed(def, tier);
    const price = maxed ? 0 : getUpgradePrice(def, tier);
    const tierLabel = def.maxTier > 1 ? ` (Tier ${tier}/${def.maxTier})` : "";
    const statusLabel = maxed ? " ✅" : "";

    builder.section(
      `${def.emoji} **${def.name}**${tierLabel}${statusLabel}\n-# ${def.description}${!maxed ? `\n-# Cost: ${price.toLocaleString()} ${config.emojis.coin}` : ""}`,
      new ButtonBuilder()
        .setCustomId(`upg:buy:${def.id}:${userId}`)
        .setLabel(maxed ? "Owned" : "Buy")
        .setStyle(maxed ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(maxed),
    );
  }

  builder.footer("Buy upgrades to boost your fishing permanently!");
  return builder.build();
}

export default {
  name: "upgrades",
  description: "View and purchase permanent profile upgrades.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/upgrades"],
  options: [],
  run: async ({ ctx }) => {
    const upgData = await getOrCreateUpgrades(ctx.user.id);

    const message = await ctx.editReply(buildUpgradesView(upgData, ctx.user.id) as any);

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === ctx.user.id && i.customId.startsWith("upg:buy:"),
      time: 5 * 60_000,
    });

    collector.on("collect", async (i) => {
      const upgradeId = i.customId.split(":")[2];
      const def = upgradeMap.get(upgradeId);
      if (!def) return i.deferUpdate();

      const currentUpgData = await getOrCreateUpgrades(ctx.user.id);
      const tier = getCurrentTier(currentUpgData, upgradeId);

      if (isMaxed(def, tier)) {
        return i.reply({
          content: `${config.emojis.cross} You already own this upgrade!`,
          flags: MessageFlags.Ephemeral,
        });
      }

      // Check prerequisites
      if (def.requires) {
        const reqTier = getCurrentTier(currentUpgData, def.requires);
        if (reqTier === 0) {
          const reqDef = upgradeMap.get(def.requires);
          return i.reply({
            content: `${config.emojis.cross} You need **${reqDef?.name ?? def.requires}** first!`,
            flags: MessageFlags.Ephemeral,
          });
        }
      }

      const price = getUpgradePrice(def, tier);
      const paid = await subtractCoins(ctx.user.id, price);
      if (!paid) {
        return i.reply({
          content: `${config.emojis.cross} Not enough coins! You need **${price.toLocaleString()}** ${config.emojis.coin}.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      // Apply the upgrade
      await setUpgradeField(ctx.user.id, upgradeId, tier + 1);

      // If auto-sell was just bought, show the threshold config modal
      if (upgradeId === "auto_sell" && tier === 0) {
        await i.reply({
          content: `${config.emojis.tick} **${def.name}** purchased! Fish worth less than **100** ${config.emojis.coin} will be auto-sold. Use \`/upgrades\` to configure the threshold.`,
          flags: MessageFlags.Ephemeral,
        });
      } else {
        const newTier = tier + 1;
        const tierText = def.maxTier > 1 ? ` (Tier ${newTier})` : "";
        await i.reply({
          content: `${config.emojis.tick} **${def.name}**${tierText} purchased for **${price.toLocaleString()}** ${config.emojis.coin}!`,
          flags: MessageFlags.Ephemeral,
        });
      }

      // Refresh the view
      const freshData = await getOrCreateUpgrades(ctx.user.id);
      await message.edit(buildUpgradesView(freshData, ctx.user.id) as any);
    });

    collector.on("end", async () => {
      try { await message.edit({ components: [] }); } catch {}
    });
  },
} as Command;
