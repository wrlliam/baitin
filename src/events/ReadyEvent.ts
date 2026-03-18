import { ActivityType, PresenceUpdateStatus, type ClientEvents, type Client } from "discord.js";
import type { Event } from "../core/typings";
import { app } from "..";
import { info } from "../utils/logger";
import { startEventScheduler, getActiveEvent } from "../modules/fishing/events";
import { checkScheduledEvents } from "../modules/fishing/events";
import { runHutCron } from "../modules/fishing/hut";
import { settleExpiredAuctions } from "../modules/fishing/market";
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
    const text = `🎪 ${event.name}`;
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
    updateStatus();
    setInterval(updateStatus, 60 * 1000); // check every minute

    // Start random event scheduler
    startEventScheduler(app as unknown as Client);

    // Hut catches every 5 minutes
    setInterval(() => runHutCron(app as unknown as Client), 5 * 60 * 1000);

    // Auction settlement every 1 minute
    setInterval(() => settleExpiredAuctions(), 60 * 1000);

    // Scheduled events (Morning Rush) every 1 minute
    setInterval(() => checkScheduledEvents(app as unknown as Client), 60 * 1000);
  },
} as Event<keyof ClientEvents>;
