import config from "@/config";
import { Command } from "@/core/typings";
import { ui, btn, thumbnail, infoMsg, type UIPayload } from "@/ui";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ApplicationCommandType,
  ComponentType,
  MessageFlags,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  Guild,
} from "discord.js";

const INFO: Record<string, string> = {
  "test:cast": "**`/cast`** — Cast your fishing line and reel in a catch!",
  "test:shop":
    "**`/shop`** — Browse rods, bait, and potions in the tackle shop.",
  "test:lb": "**`/leaderboard`** — See the top fishers on the server.",
  "test:profile":
    "**`/profile`** — View your fishing stats, equipped gear, and level.",
  "test:claim":
    "**`/daily`** — Claim your daily coin reward (resets every 24 hours).",
};

const FISH_INFO: Record<string, string> = {
  tuna: "🐟 **Tuna** — A fast, deep-sea predator. Common catch, decent sell price.",
  puffer:
    "🐡 **Pufferfish** — Inflates when threatened. Rare catch with a high sell price.",
  shark:
    "🦈 **Shark** — Apex ocean predator. Very rare and extremely valuable!",
  clown:
    "🐠 **Clownfish** — Lives among anemones. Uncommon catch, low value but cute.",
  squid:
    "🦑 **Squid** — Eight arms, two tentacles. Common catch, low sell price.",
};

export default {
  name: "test",
  description: "Showcases all Components V2 UI features.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/test"],
  options: [],
  devOnly: true,
  run: async ({ ctx, client }) => {
    client.emit("guildCreate", ctx.guild as Guild);

    // Build a gallery for the image section
    const galleryComponent = new MediaGalleryBuilder() as any;
    galleryComponent.addItems(
      (new MediaGalleryItemBuilder() as any)
        .setURL("https://picsum.photos/seed/baitin1/400/300")
        .setDescription("Ocean scene"),
      (new MediaGalleryItemBuilder() as any)
        .setURL("https://picsum.photos/seed/baitin2/400/300")
        .setDescription("Fishing dock"),
      (new MediaGalleryItemBuilder() as any)
        .setURL("https://picsum.photos/seed/baitin3/400/300")
        .setDescription("Deep sea"),
    );

    // Action row with buttons (outside container)
    const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("test:cast")
        .setLabel("Cast Line")
        .setEmoji("🎣")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("test:shop")
        .setLabel("Open Shop")
        .setEmoji("🛒")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("test:lb")
        .setLabel("Leaderboard")
        .setEmoji("🏆")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("test:noop")
        .setLabel("Disabled")
        .setEmoji("🚫")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
    );

    // Select menu row
    const selectRow =
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("test:select")
          .setPlaceholder("Choose a fish to learn about…")
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel("🐟 Tuna")
              .setValue("tuna")
              .setDescription("Fast, deep-sea predator."),
            new StringSelectMenuOptionBuilder()
              .setLabel("🐡 Pufferfish")
              .setValue("puffer")
              .setDescription("Inflates when threatened."),
            new StringSelectMenuOptionBuilder()
              .setLabel("🦈 Shark")
              .setValue("shark")
              .setDescription("Apex ocean predator."),
            new StringSelectMenuOptionBuilder()
              .setLabel("🐠 Clownfish")
              .setValue("clown")
              .setDescription("Lives in anemones."),
            new StringSelectMenuOptionBuilder()
              .setLabel("🦑 Squid")
              .setValue("squid")
              .setDescription("Eight arms, two tentacles."),
          ),
      );

    const message_payload = ui()
      .color(config.colors.default)
      .title("🎣 Baitin — Components V2 Showcase")
      .body("A live demo of every Components V2 feature. Poke the buttons!")
      .divider()
      .title("📝 Text Formatting")
      .body(
        "Regular  •  **Bold**  •  *Italic*  •  __Underline__  •  ~~Strike~~\n`Monospace label`\n```js\nconsole.log('hello, baitin!');\n```\n- Caught a Tuna\n- Caught a Salmon\n- Caught a Pufferfish",
      )
      .divider()
      .title("📦 Sections")
      .body(
        "A section renders text on the left with an accessory on the right.",
      )
      .section(
        "**Fishing Profile**\nLevel 12 · 1,340 fish caught · 42,500 🪙",
        btn("View Profile", "test:profile").setEmoji("🎣"),
      )
      .section(
        "**Daily Reward**\nYou have an unclaimed daily reward waiting!",
        btn("Claim Now", "test:claim").setEmoji("📅"),
      )
      .divider()
      .title("🔘 Button Row")
      .body("Up to 5 buttons in a row. See below ↓")
      .divider()
      .title("📋 Select Menu")
      .body("Dropdown with labelled options and descriptions. See below ↓")
      .divider()
      .footer(`Built with Components V2  ·  Baitin  ·  /help`)
      .build({ rows: [buttonRow, selectRow] });

    const reply = await ctx.editReply(message_payload as any);

    const collector = reply.createMessageComponentCollector({
      time: 3 * 60 * 1000,
      filter: (i) => i.user.id === ctx.user.id,
    });

    collector.on("collect", async (i) => {
      if (i.isButton()) {
        const info = INFO[i.customId] ?? `Button \`${i.customId}\` clicked!`;
        await i.reply({
          flags: MessageFlags.Ephemeral,
          components: infoMsg("💡 Command Info", info).components,
        } as any);
      } else if (i.componentType === ComponentType.StringSelect) {
        const value = (i as any).values?.[0] as string;
        const info = FISH_INFO[value] ?? `Selected: \`${value}\``;
        await i.reply({
          flags: MessageFlags.Ephemeral,
          components: infoMsg("🐟 Fish Info", info).components,
        } as any);
      }
    });
  },
} as Command;
