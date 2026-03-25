import config from "@/config";
import { ui } from "@/ui";
import {
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  GuildMember,
  type ClientEvents,
  Guild,
  GuildChannel,
  ChannelType,
  TextChannel,
} from "discord.js";
import type { Event } from "../core/typings";
import { app } from "..";

// Guilds that existed at startup — guildCreate fires for these on reconnect
const startupGuilds = new Set<string>();
let startupRecorded = false;

export function recordStartupGuilds(guilds: Iterable<string>) {
  for (const id of guilds) startupGuilds.add(id);
  startupRecorded = true;
}

export default {
  name: "guildCreate",
  run: async (guild: Guild) => {
    // Only send welcome on a real new guild join, not on reconnect/availability
    if (!app.isReady()) return;
    if (startupGuilds.has(guild.id)) return;
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("Get Started")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🎣")
        .setCustomId("welcome_get_started"),
      new ButtonBuilder()
        .setLabel("Support Server")
        .setStyle(ButtonStyle.Link)
        .setURL(config.support)
        .setEmoji("🛟"),
    );

    const msg = ui()
      .color(0x2b7fff)
      .text(`Hello there... This is **Baitin**.`)
      .gap()
      .text(
        `Below is a list of features to get you started.\nJust run </help:0> to see a list of commands!`,
      )
      .divider()
      .text(
        [
          `- **Economy:** Earn coins daily, weekly, and monthly. Work, beg, search, auction and commit crimes.`,
          `- **Fishing:** Cast your line, catch rare fish, upgrade your rod, and build out your fishing hut.`,
          `- **Gambling:** Flip coins, spin slots, gamble your way to riches — or ruin.`,
          `- **Pets:** Collect and take care of pets that give you fishing buffs and bonuses.`,
          `- **Leaderboards:** Compete platform-wide for the top spot.`,
          `And more...`,
        ].join("\n"),
      )
      .divider()
      .footer(`If you're ready, the button below will get you started!`)
      .gallery([
        {
          url: `https://cdn.discordapp.com/attachments/1483633136427335800/1483633328929243206/banner.png?ex=69bb4cb6&is=69b9fb36&hm=5864a0addbe3f35cf7ba98282e8aaa4413eb54481e269abf8210f50ca3652f4d&`,
        },
      ])
      .build({ rows: [row] });

    const channel = guild.channels.cache.filter(
      (f) =>
        f.type === ChannelType.GuildText &&
        f
          .permissionsFor(
            guild.members.cache.find(
              (f) => f.id === app.user?.id,
            ) as GuildMember,
          )
          .has("SendMessages"),
    );

    if (channel.first()?.isSendable()) {
      (channel.first() as TextChannel).send(msg);
    }
  },
} as Event<keyof ClientEvents>;
