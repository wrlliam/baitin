import { db } from "@/db";
import { fishingProfile } from "@/db/schema";
import { eq } from "drizzle-orm";
import { checkCooldown, setCooldown } from "@/modules/fishing/economy_games";
import { addCoins, getOrCreateProfile } from "@/modules/fishing/economy";
import { ui } from "@/ui";
import config from "@/config";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  ComponentType,
} from "discord.js";

const COOLDOWN_SECS = 86400;
const BASE_REWARD = 125;
const LEVEL_BONUS = 25;

/**
 * Send daily reminder DMs to all users who have opted in and whose daily cooldown has expired.
 * Runs once per hour from the cron in ReadyEvent.
 */
export async function runDailyReminderCron(client: Client) {
  const users = await db
    .select({ userId: fishingProfile.userId })
    .from(fishingProfile)
    .where(eq(fishingProfile.dailyReminders, true));

  for (const { userId } of users) {
    try {
      const cooldown = await checkCooldown(userId, "daily");
      if (!cooldown.ok) continue; // Still on cooldown

      const user = await client.users.fetch(userId).catch(() => null);
      if (!user) continue;

      const collectBtn = new ButtonBuilder()
        .setCustomId(`daily:collect:${userId}`)
        .setLabel("Collect")
        .setEmoji("💰")
        .setStyle(ButtonStyle.Success);

      const notifBtn = new ButtonBuilder()
        .setCustomId(`daily:notif:${userId}`)
        .setLabel("Notifications")
        .setEmoji("✅")
        .setStyle(ButtonStyle.Success);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(collectBtn, notifBtn);

      const dm = await user.send(
        ui()
          .color(config.colors.default)
          .title(`${config.emojis.calendar} Daily Reward Available!`)
          .body("Your daily reward is ready to collect!")
          .footer("Click Collect to claim your coins, or toggle notifications off.")
          .build({ rows: [row] }) as any,
      ).catch(() => null);

      if (!dm) {
        // Can't DM user — disable their reminders
        await db
          .update(fishingProfile)
          .set({ dailyReminders: false })
          .where(eq(fishingProfile.userId, userId));
        continue;
      }

      // Handle button interactions
      const collector = dm.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === userId,
        time: 24 * 60 * 60 * 1000, // 24 hours
        max: 5,
      });

      collector.on("collect", async (i) => {
        if (i.customId === `daily:collect:${userId}`) {
          // Re-check cooldown at click time
          const cd = await checkCooldown(userId, "daily");
          if (!cd.ok) {
            const nextAvailable = Math.floor(cd.expiresAt! / 1000);
            await i.reply({
              content: `${config.emojis.cross} Already claimed! Next daily: <t:${nextAvailable}:R>`,
              ephemeral: true,
            });
            return;
          }

          const profile = await getOrCreateProfile(userId);
          const coins = BASE_REWARD + profile.level * LEVEL_BONUS;

          await addCoins(userId, coins);
          await setCooldown(userId, "daily", COOLDOWN_SECS);

          const baseReward = BASE_REWARD;
          const levelBonus = profile.level * LEVEL_BONUS;

          await i.update(
            ui()
              .color(config.colors.success)
              .title(`${config.emojis.calendar} Daily Reward Claimed!`)
              .body(`You claimed your daily reward!`)
              .divider()
              .text(
                `**Base Reward:** ${baseReward.toLocaleString()} ${config.emojis.coin}\n**Level Bonus:** +${levelBonus.toLocaleString()} ${config.emojis.coin} (${profile.level} × ${LEVEL_BONUS})\n**Total:** **${coins.toLocaleString()}** ${config.emojis.coin}`,
              )
              .divider()
              .text(
                `Next daily available: <t:${Math.floor(Date.now() / 1000 + COOLDOWN_SECS)}:R>`,
              )
              .footer("Daily rewards increase with your level!")
              .build() as any,
          );
          collector.stop();
        } else if (i.customId === `daily:notif:${userId}`) {
          // Toggle notifications off
          await db
            .update(fishingProfile)
            .set({ dailyReminders: false })
            .where(eq(fishingProfile.userId, userId));

          // Update the button to show disabled state
          const collectBtn = new ButtonBuilder()
            .setCustomId(`daily:collect:${userId}`)
            .setLabel("Collect")
            .setEmoji("💰")
            .setStyle(ButtonStyle.Success);

          const disabledNotifBtn = new ButtonBuilder()
            .setCustomId(`daily:notif:${userId}`)
            .setLabel("Notifications")
            .setEmoji("❌")
            .setStyle(ButtonStyle.Secondary);

          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            collectBtn,
            disabledNotifBtn,
          );

          await i.update(
            ui()
              .color(config.colors.default)
              .title(`${config.emojis.calendar} Daily Reward Available!`)
              .body("Your daily reward is ready to collect!\n\n*Daily reminders have been turned off.*")
              .footer("Re-enable via /settings view")
              .build({ rows: [row] }) as any,
          );
        }
      });
    } catch {
      // Skip user on error
    }
  }
}
