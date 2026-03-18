import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { achievementDefs } from "@/data/achievements";
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
  User,
  MessageFlags,
} from "discord.js";

const CATEGORY_LABELS: Record<string, string> = {
  catches: "🎣 Catches",
  economy: "💰 Economy",
  gear: "⚙️ Gear",
  social: "🤝 Social",
  fun: "🎉 Fun",
};

const CATEGORIES = ["catches", "economy", "gear", "social", "fun"] as const;
type AchCat = (typeof CATEGORIES)[number];

async function buildPage(target: User, category: AchCat) {
  const rows = await db
    .select()
    .from(achievement)
    .where(eq(achievement.userId, target.id));

  const unlockedMap = new Map(rows.map((r) => [r.achievementId, r.unlockedAt]));

  const inCategory = achievementDefs.filter((a) => a.category === category);
  const unlockedCount = inCategory.filter((a) => unlockedMap.has(a.id)).length;

  const lines = inCategory.map((a) => {
    const unlockedAt = unlockedMap.get(a.id);
    if (unlockedAt) {
      const ts = `<t:${Math.floor(unlockedAt.getTime() / 1000)}:d>`;
      return `${a.emoji} **${a.name}** — ${a.description}\n-# ✅ Unlocked ${ts} • +${a.coinReward}${config.emojis.coin} +${a.xpReward}XP`;
    } else {
      return `🔒 **${a.name}** — ${a.description}`;
    }
  });

  const totalUnlocked = rows.length;
  const totalDefs = achievementDefs.length;

  const embed = ui()
    .color(config.colors.default)
    .title(`🏅 Achievements — ${CATEGORY_LABELS[category]}`)
    .text(
      `**${target.username}** — ${totalUnlocked}/${totalDefs} unlocked\n` +
        `${CATEGORY_LABELS[category]}: ${unlockedCount}/${inCategory.length}`,
    )
    .divider()
    .text(lines.join("\n\n"))
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
    let embed = await buildPage(target, activeTab);

    const message = await ctx.editReply(
      embed.build({ rows: [buildTabRow(activeTab)] }) as any,
    );

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === ctx.user.id,
      time: 5 * 60 * 1000,
    });

    collector.on("collect", async (i) => {
      if (!i.customId.startsWith("ach:tab:")) return i.deferUpdate();
      activeTab = i.customId.replace("ach:tab:", "") as AchCat;
      const newEmbed = await buildPage(target, activeTab);
      await i.update(newEmbed.build({ rows: [buildTabRow(activeTab)] }) as any);
    });

    collector.on("end", async () => {
      try {
        await message.edit({ components: [] });
      } catch {}
    });
  },
} as Command;
