import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import {
  rodItems,
  baitItems,
  petItems,
  sackTiers,
  allItems,
  fishItems,
} from "@/data";
import { getOrCreateProfile } from "@/modules/fishing/economy";
import { getActiveBuffs } from "@/modules/fishing/buffs";
import {
  getInventory,
  getItemCount,
  getSackCapacity,
} from "@/modules/fishing/inventory";
import { db } from "@/db";
import { fishingLog, petInstance } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  User,
  MessageFlags,
} from "discord.js";

type ProfileTab = "overview" | "gear" | "stats" | "buffs";

function xpBar(current: number, total: number, length = 12): string {
  const filled = Math.min(length, Math.floor((current / total) * length));
  return "█".repeat(filled) + "░".repeat(length - filled);
}

function buildTabRow(active: ProfileTab): ActionRowBuilder<ButtonBuilder> {
  const tabs: { key: ProfileTab; label: string }[] = [
    { key: "overview", label: "📊 Overview" },
    { key: "gear", label: "🎣 Gear" },
    { key: "stats", label: "📈 Stats" },
    { key: "buffs", label: "✨ Buffs" },
  ];
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    tabs.map((t) =>
      new ButtonBuilder()
        .setCustomId(`profile:tab:${t.key}`)
        .setLabel(t.label)
        .setStyle(
          t.key === active ? ButtonStyle.Primary : ButtonStyle.Secondary,
        ),
    ),
  );
}

async function buildOverview(target: User) {
  const profile = await getOrCreateProfile(target.id);
  const xpIntoLevel = profile.xp % config.xpPerLevel;
  const bar = xpBar(xpIntoLevel, config.xpPerLevel);
  const used = await getItemCount(target.id);
  const capacity = await getSackCapacity(target.id);
  const sackTier = sackTiers.find((t) => t.level === profile.sackLevel);
  const joinedTs = profile.createdAt
    ? `<t:${Math.floor(profile.createdAt.getTime() / 1000)}:D>`
    : "Unknown";

  const streak = (profile as any).currentStreak ?? 0;
  const streakText =
    streak > 1
      ? `🔥 ${streak}-day streak (+${Math.min((streak - 1) * 5, 50)}% XP/coins)`
      : streak === 1
        ? "🔥 1-day streak (fish again tomorrow to build it!)"
        : "No streak yet";

  return ui()
    .color(config.colors.default)
    .section(
      `**${target.username}**\nLevel **${profile.level}** Fisher`,
      ui.thumb(target.displayAvatarURL({ extension: "png", size: 128 })),
    )
    .gap()
    .text(`\`[${bar}]\` ${xpIntoLevel}/${config.xpPerLevel} XP to next level`)
    .divider()
    .text(
      `${config.emojis.coin} **Wallet** — ${profile.coins.toLocaleString()} coins\n` +
      `🎣 **Total Catches** — ${profile.totalCatches.toLocaleString()}\n` +
      `🎒 **Sack** — ${used}/${capacity} items (Tier ${profile.sackLevel}${sackTier ? ` — ${sackTier.capacity} cap` : ""})\n` +
      `📅 **Fishing Since** — ${joinedTs}\n` +
      `📆 **Daily Streak** — ${streakText}\n` +
      `💖 **Reputation** — ${(profile as any).reputation ?? 0} rep`,
    )
    .footer("Baitin • Use tabs above for more details");
}

async function buildGear(target: User) {
  const profile = await getOrCreateProfile(target.id);
  const rod = rodItems.get(profile.equippedRodId ?? "splintered_twig");
  const bait = profile.equippedBaitId
    ? baitItems.get(profile.equippedBaitId)
    : null;

  const petLines: string[] = [];
  for (const instanceId of profile.equippedPets) {
    const rows = await db
      .select()
      .from(petInstance)
      .where(eq(petInstance.id, instanceId));
    if (!rows[0]) continue;
    const pet = petItems.get(rows[0].petId);
    if (!pet) continue;
    const displayName = rows[0].name ?? pet.name;
    petLines.push(`${pet.emoji} **${displayName}** Lv ${rows[0].petLevel}`);
  }

  const durabilityText =
    rod && rod.durability > 0
      ? ` (${profile.equippedRodDurability ?? rod.durability}/${rod.durability} uses left)`
      : rod
        ? " (∞ durability)"
        : "";

  return ui()
    .color(config.colors.default)
    .section(
      `**${target.username}**\nEquipped Gear`,
      ui.thumb(target.displayAvatarURL({ extension: "png", size: 128 })),
    )
    .divider()
    .text(
      `🎣 **Rod** — ${rod ? `${rod.emoji} ${rod.name}${durabilityText}` : "None equipped"}\n` +
      `🪱 **Bait** — ${bait ? `${bait.emoji} ${bait.name} (+${Math.round(bait.rarityMultiplier * 100 - 100)}% rarity)` : "No bait equipped"}\n` +
      `🐾 **Pets** — ${petLines.length > 0 ? petLines.join(", ") : "No pets equipped — use `/pets equip`"}`,
    )
    .footer(`Equip gear with /equip and /pets equip`);
}

async function buildStats(target: User) {
  const profile = await getOrCreateProfile(target.id);
  const logs = await db
    .select()
    .from(fishingLog)
    .where(eq(fishingLog.userId, target.id));
  const inventory = await getInventory(target.id);

  // Count catches by rarity
  const rarityCount: Record<string, number> = {};
  for (const log of logs) {
    const item = allItems.get(log.itemId);
    const rarity = item ? item.rarity : "unknown";
    rarityCount[rarity] = (rarityCount[rarity] ?? 0) + 1;
  }

  const rarityOrder = [
    "mythic",
    "legendary",
    "epic",
    "rare",
    "uncommon",
    "common",
  ];
  const rarityEmojis: Record<string, string> = {
    mythic: "✦✦",
    legendary: "✦",
    epic: "❖",
    rare: "◆",
    uncommon: "◆",
    common: "○",
  };

  const rarityLines = rarityOrder
    .filter((r) => rarityCount[r])
    .map(
      (r) =>
        `${rarityEmojis[r] ?? "○"} **${r.charAt(0).toUpperCase() + r.slice(1)}:** ${rarityCount[r].toLocaleString()}`,
    );

  // Inventory value estimate
  const inventoryValue = inventory.reduce((sum, row) => {
    const item = allItems.get(row.itemId);
    if (!item) return sum;
    return (
      sum +
      Math.floor(item.price * config.fishing.sellPriceMultiplier * row.quantity)
    );
  }, 0);

  // Most caught fish
  const itemCounts: Record<string, number> = {};
  for (const log of logs.filter((l) => l.itemType === "fish")) {
    itemCounts[log.itemId] = (itemCounts[log.itemId] ?? 0) + 1;
  }
  const topFishId = Object.entries(itemCounts).sort((a, b) => b[1] - a[1])[0];
  const topFish = topFishId ? allItems.get(topFishId[0]) : null;

  return ui()
    .color(config.colors.default)
    .section(
      `**${target.username}**\nCatch Statistics`,
      ui.thumb(target.displayAvatarURL({ extension: "png", size: 128 })),
    )
    .divider()
    .text(
      `🎣 **Total Catches** — ${profile.totalCatches.toLocaleString()} total (${logs.length.toLocaleString()} logged)\n` +
      `💰 **Inventory Value** — ~${inventoryValue.toLocaleString()} ${config.emojis.coin}\n` +
      `🏆 **Favourite Fish** — ${topFish ? `${topFish.emoji} ${topFish.name} (×${topFishId![1]})` : "None yet"}`,
    )
    .divider()
    .text(
      rarityLines.length > 0
        ? `**Catches by Rarity**\n${rarityLines.join("\n")}`
        : "*No catches logged yet — use /cast to start!*",
    )
    .footer("Stats based on fishing log history");
}

async function buildBuffs(target: User) {
  const buffs = await getActiveBuffs(target.id);
  const builder = ui()
    .color(config.colors.default)
    .section(
      `**${target.username}**\nActive Buffs`,
      ui.thumb(target.displayAvatarURL({ extension: "png", size: 128 })),
    )
    .divider();

  if (buffs.length === 0) {
    builder.text("*No active buffs. Use `/use` to apply a potion!*");
  } else {
    const buffLines = buffs.map((b) => {
      const remaining = Math.ceil((b.expiresAt - Date.now()) / 60000);
      const sign = b.amount >= 0 ? "+" : "";
      const label = b.type
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      return `✨ **${label}** — ${sign}${Math.round(b.amount * 100)}% — expires in **${remaining}m**`;
    });
    builder.text(buffLines.join("\n"));
  }

  return builder.footer("Use /use to apply potions from your sack");
}

export default {
  name: "profile",
  description: "View your fishing profile.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/profile", "/profile [user]"],
  options: [
    {
      name: "user",
      description: "The user whose profile to view.",
      type: ApplicationCommandOptionType.User,
      required: false,
    },
  ],
  run: async ({ args, client, ctx }) => {
    const target = args.getUser("user") ?? ctx.user;

    let activeTab: ProfileTab = "overview";
    let contentBuilder = await buildOverview(target);

    const message = await ctx.editReply(
      contentBuilder.build({ rows: [buildTabRow(activeTab)] }) as any,
    );

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === ctx.user.id,
      time: 5 * 60 * 1000,
    });

    collector.on("collect", async (i) => {
      if (!i.customId.startsWith("profile:tab:")) return i.deferUpdate();

      activeTab = i.customId.replace("profile:tab:", "") as ProfileTab;

      let builder;
      if (activeTab === "overview") builder = await buildOverview(target);
      else if (activeTab === "gear") builder = await buildGear(target);
      else if (activeTab === "stats") builder = await buildStats(target);
      else builder = await buildBuffs(target);

      await i.update(builder.build({ rows: [buildTabRow(activeTab)] }) as any);
    });

    collector.on("end", async () => {
      try {
        await message.edit({ components: [] });
      } catch {}
    });
  },
} as Command;
