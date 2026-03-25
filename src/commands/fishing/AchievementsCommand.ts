import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { achievementDefs, type ProgressType } from "@/data/achievements";
import { getAchievementProgress } from "@/modules/fishing/achievements";
import { db } from "@/db";
import { achievement } from "@/db/schema";
import { eq } from "drizzle-orm";
import config from "@/config";
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  User,
  MessageFlags,
} from "discord.js";

const CATEGORY_LABELS: Record<string, string> = {
  catches: `${config.emojis.rod} Catches`,
  economy: `${config.emojis.coin} Economy`,
  gear: `${config.emojis.gear} Gear`,
  social: `${config.emojis.handshake} Social`,
  fun: `${config.emojis.party} Fun`,
};

const CATEGORIES = ["catches", "economy", "gear", "social", "fun"] as const;
type AchCat = (typeof CATEGORIES)[number];

function progressBar(current: number, goal: number, width = 10): string {
  const filled = Math.min(width, Math.floor((current / goal) * width));
  return "█".repeat(filled) + "░".repeat(width - filled);
}

async function buildPage(
  target: User,
  category: AchCat,
  search: string | null,
  progress: Record<ProgressType, number>,
) {
  const rows = await db
    .select()
    .from(achievement)
    .where(eq(achievement.userId, target.id));

  const unlockedMap = new Map(rows.map((r) => [r.achievementId, r.unlockedAt]));

  let inCategory = achievementDefs.filter((a) => a.category === category);

  // Apply search filter
  if (search) {
    const q = search.toLowerCase();
    inCategory = inCategory.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q),
    );
  }

  const unlockedCount = inCategory.filter((a) => unlockedMap.has(a.id)).length;

  const lines = inCategory.map((a) => {
    const unlockedAt = unlockedMap.get(a.id);
    if (unlockedAt) {
      const ts = `<t:${Math.floor(unlockedAt.getTime() / 1000)}:d>`;
      return `${a.emoji} **${a.name}** — ${a.description}\n-# ${config.emojis.tick} Unlocked ${ts} • +${a.coinReward}${config.emojis.coin} +${a.xpReward}XP`;
    } else {
      // Show progress bar for locked achievements with a goal
      if (a.goal && a.progressType) {
        const current = Math.min(progress[a.progressType], a.goal);
        const bar = progressBar(current, a.goal);
        const unit = a.progressType === "collection" ? "%" : "";
        return `${config.emojis.lock} **${a.name}** — ${a.description}\n-# \`[${bar}]\` ${current}${unit}/${a.goal}${unit}`;
      }
      return `${config.emojis.lock} **${a.name}** — ${a.description}`;
    }
  });

  const totalUnlocked = rows.filter((r) => !r.achievementId.startsWith("__")).length;
  const totalDefs = achievementDefs.length;

  const embed = ui()
    .color(config.colors.default)
    .title(`${config.emojis.achievement} Achievements — ${CATEGORY_LABELS[category]}`)
    .text(
      `**${target.username}** — ${totalUnlocked}/${totalDefs} unlocked\n` +
        `${CATEGORY_LABELS[category]}: ${unlockedCount}/${inCategory.length}` +
        (search ? `\n🔍 Searching: "${search}"` : ""),
    )
    .divider()
    .text(lines.length > 0 ? lines.join("\n\n") : "*No achievements match your search.*")
    .footer("Complete achievements to earn bonus coins and XP!");

  return embed;
}

function buildTabRow(active: AchCat): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    CATEGORIES.map((cat) =>
      new ButtonBuilder()
        .setCustomId(`ach:tab:${cat}`)
        .setLabel(CATEGORY_LABELS[cat])
        .setStyle(cat === active ? ButtonStyle.Primary : ButtonStyle.Secondary),
    ),
  );
}

function buildSearchRow(userId: string): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`ach:search:${userId}`)
      .setPlaceholder("🔍 Filter achievements...")
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel("Show All").setValue("__all__").setDescription("Remove search filter"),
        new StringSelectMenuOptionBuilder().setLabel("Catches & Milestones").setValue("catch").setDescription("Filter by catch-related"),
        new StringSelectMenuOptionBuilder().setLabel("Rarity").setValue("rare").setDescription("Rare, Epic, Legendary, Mythic"),
        new StringSelectMenuOptionBuilder().setLabel("Streak").setValue("streak").setDescription("Streak-related achievements"),
        new StringSelectMenuOptionBuilder().setLabel("Collection").setValue("collector").setDescription("Species collection milestones"),
        new StringSelectMenuOptionBuilder().setLabel("Junk").setValue("junk").setDescription("Junk-related achievements"),
      ),
  );
}

export default {
  name: "achievements",
  description: "View your achievements and badges.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/achievements", "/achievements [user]"],
  options: [
    {
      name: "user",
      description: "The user whose achievements to view.",
      type: ApplicationCommandOptionType.User,
      required: false,
    },
  ],
  run: async ({ args, ctx }) => {
    const target = args.getUser("user") ?? ctx.user;

    let activeTab: AchCat = "catches";
    let searchQuery: string | null = null;

    const progress = await getAchievementProgress(target.id);
    let embed = await buildPage(target, activeTab, searchQuery, progress);

    const message = await ctx.editReply(
      embed.build({ rows: [buildSearchRow(ctx.user.id), buildTabRow(activeTab)] }) as any,
    );

    const collector = message.createMessageComponentCollector({
      filter: (i) => i.user.id === ctx.user.id,
      time: 5 * 60 * 1000,
    });

    collector.on("collect", async (i) => {
      if (i.customId.startsWith("ach:tab:")) {
        activeTab = i.customId.replace("ach:tab:", "") as AchCat;
        const newEmbed = await buildPage(target, activeTab, searchQuery, progress);
        await i.update(
          newEmbed.build({ rows: [buildSearchRow(ctx.user.id), buildTabRow(activeTab)] }) as any,
        );
        return;
      }

      if (i.customId === `ach:search:${ctx.user.id}` && i.isStringSelectMenu()) {
        const val = i.values[0];
        searchQuery = val === "__all__" ? null : val;
        const newEmbed = await buildPage(target, activeTab, searchQuery, progress);
        await i.update(
          newEmbed.build({ rows: [buildSearchRow(ctx.user.id), buildTabRow(activeTab)] }) as any,
        );
        return;
      }

      await i.deferUpdate();
    });

    collector.on("end", async () => {
      try {
        await message.edit({ components: [] });
      } catch {}
    });
  },
} as Command;
