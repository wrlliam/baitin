import { ActivityType, PresenceUpdateStatus, type ClientEvents, type Client } from "discord.js";
import type { Event } from "../core/typings";
import { app } from "..";
import { info } from "../utils/logger";
import { startEventScheduler, getActiveEvent } from "../modules/fishing/events";
import { checkScheduledEvents } from "../modules/fishing/events";
import { runHutCron } from "../modules/fishing/hut";
import { settleExpiredAuctions } from "../modules/fishing/market";
import { runDailyReminderCron } from "../modules/fishing/dailyReminder";
import { recordStartupGuilds } from "./GuildCreateEvent";
import config from "@/config";

const STATUSES = [
  "🎣 teaching fish to dodge hooks",
  "🐟 counting fish that got away",
  "🪱 worm whisperer extraordinaire",
  "🎣 /cast — if you dare",
  "🦈 negotiating with sharks",
  "🐡 inflating the economy",
  "🎣 professional line-caster",
  "🥇 definitely not rigged",
  "🦐 shrimp enthusiast",
  "🎣 90% waiting, 10% reeling",
  "🐙 octopus spotted. panicking.",
  "💸 coins go brrr",
  "🎣 your rod is waiting",
  "🦞 lobster liberation front",
  "🌊 vibes only, no fishing required",
];

async function updateStatus() {
  const event = await getActiveEvent();
  if (event) {
    const text = `${config.emojis.event} ${event.name}`;
    app.user?.setPresence({
      status: PresenceUpdateStatus.DoNotDisturb,
      activities: [{ name: text, state: text, type: ActivityType.Custom }],
    });
  } else {
    const status = STATUSES[Math.floor(Math.random() * STATUSES.length)];
    app.user?.setPresence({
      status: PresenceUpdateStatus.Online,
      activities: [{ name: status, state: status, type: ActivityType.Custom }],
    });
  }
}

export default {
  name: "clientReady",
  run: () => {
    // Record all guilds the bot is already in so guildCreate doesn't
    // send welcome messages for them on reconnect/availability
    recordStartupGuilds(app.guilds.cache.keys());

    updateStatus();
    setInterval(async () => { try { await updateStatus(); } catch {} }, 60 * 1000);

    // Start random event scheduler
    startEventScheduler(app as unknown as Client);

    // Hut catches every 5 minutes
    setInterval(async () => { try { await runHutCron(app as unknown as Client); } catch {} }, 5 * 60 * 1000);

    // Auction settlement every 1 minute
    setInterval(async () => { try { await settleExpiredAuctions(); } catch {} }, 60 * 1000);

    // Scheduled events (Morning Rush) every 1 minute
    setInterval(async () => { try { await checkScheduledEvents(app as unknown as Client); } catch {} }, 60 * 1000);

    // Daily reminder DMs every hour
    setInterval(async () => { try { await runDailyReminderCron(app as unknown as Client); } catch {} }, 60 * 60 * 1000);
  },
} as Event<keyof ClientEvents>;
