import config from "@/config";
import { ui, btn } from "@/ui";
import { Command } from "@/core/typings";
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} from "discord.js";

type CategoryKey = "general" | "rewards" | "fishing" | "games" | "pvp";

const CATEGORIES: Record<
  CategoryKey,
  { label: string; emoji: string; commands: { name: string; desc: string }[] }
> = {
  general: {
    label: "General",
    emoji: "🌐",
    commands: [
      { name: "getting-started", desc: "New? Start here — learn the basics." },
      { name: "ping", desc: "Check bot and API latency." },
      { name: "avatar", desc: "View a user's avatar." },
      { name: "userinfo", desc: "View info about a user." },
      { name: "serverinfo", desc: "View info about this server." },
      { name: "8ball", desc: "Ask the magic 8-ball a question." },
    ],
  },
  rewards: {
    label: "Easy Rewards",
    emoji: "💰",
    commands: [
      { name: "daily", desc: "Claim your daily coin reward." },
      { name: "weekly", desc: "Claim your weekly coin reward." },
      { name: "monthly", desc: "Claim your monthly coin reward." },
      { name: "work", desc: "Work at the docks and earn coins." },
      { name: "beg", desc: "Beg at the docks for spare change." },
      { name: "search", desc: "Search around for hidden loot and coins." },
      { name: "leaderboard", desc: "View the top fishers on the server." },
    ],
  },
  fishing: {
    label: "Fishing",
    emoji: "🎣",
    commands: [
      { name: "cast", desc: "Cast your line and catch fish." },
      { name: "sell", desc: "Sell fish from your inventory." },
      { name: "equip", desc: "Equip a rod or bait." },
      { name: "shop", desc: "Browse the tackle shop." },
      { name: "hut", desc: "Manage your fishing hut." },
      { name: "profile", desc: "View your fishing profile and stats." },
      { name: "use", desc: "Use a potion or consumable item." },
    ],
  },
  games: {
    label: "Games",
    emoji: "🎰",
    commands: [
      { name: "gamble", desc: "Bet coins in a dice game." },
      { name: "slots", desc: "Spin the slot machine." },
      { name: "flip", desc: "Flip a coin for double or nothing." },
      { name: "crime", desc: "Commit a crime for big rewards." },
      { name: "sack", desc: "View and manage your sack inventory." },
    ],
  },
  pvp: {
    label: "Player vs Player",
    emoji: "⚔️",
    commands: [
      { name: "steal", desc: "Attempt to steal coins from another player." },
      { name: "market", desc: "Buy and sell items on the player market." },
      { name: "pets", desc: "View and manage your pets." },
      { name: "profile", desc: "View another player's profile." },
    ],
  },
};

function buildTabRow(activeTab: CategoryKey): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    (Object.keys(CATEGORIES) as CategoryKey[]).map((key) =>
      new ButtonBuilder()
        .setCustomId(`help:tab:${key}`)
        .setLabel(CATEGORIES[key].label)
        .setStyle(
          key === activeTab ? ButtonStyle.Primary : ButtonStyle.Secondary,
        ),
    ),
  );
}

function buildPayload(activeTab: CategoryKey) {
  const cat = CATEGORIES[activeTab];
  const builder = ui()
    .color(config.colors.default)
    .title(`${cat.emoji} Command Center — ${cat.label}`)
    .quote(
      "Here are Baitin's most popular commands. This isn't everything — use `/help [command]` for full details!",
    )
    .divider();

  for (const cmd of cat.commands) {
    builder.section(
      `**/${cmd.name}**\n${cmd.desc}`,
      btn(`/${cmd.name}`, `help:cmd:${cmd.name}`, ButtonStyle.Secondary),
    );
  }

  builder.footer("Baitin • /help [command] for detailed info");

  return builder.build({ rows: [buildTabRow(activeTab)] });
}

export default {
  name: "help",
  description: "Opens the Baitin Command Center.",
  usage: ["/help", "/help [command]"],
  type: ApplicationCommandType.ChatInput,
  defer: "none",
  options: [
    {
      name: "command",
      description: "Get detailed info for a specific command",
      type: ApplicationCommandOptionType.String,
      autocomplete: true,
      required: false,
    },
  ],
  autocomplete: ({ ctx, client }) => {
    const focusedValue = ctx.options.getFocused();
    const choices = client.commands
      .values()
      .filter((cmd) => cmd.name.toLowerCase() !== "help")
      .map((cmd) => cmd.name)
      .toArray();

    const filtered = choices.filter((choice) =>
      choice.toLowerCase().startsWith(focusedValue.toLowerCase()),
    );

    ctx.respond(
      filtered.slice(0, 25).map((choice) => ({ name: choice, value: choice })),
    );
  },
  run: async ({ args, client, ctx }) => {
    const commandName = args.getString("command");

    if (commandName) {
      const command = client.commands.get(commandName.toLowerCase());
      if (!command) {
        return ctx.reply({
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
          components: ui()
            .color(config.colors.default)
            .title("Command Not Found")
            .body(
              `No command named \`/${commandName}\` exists. Use \`/help\` to browse all commands.`,
            )
            .build().components,
        } as any);
      }

      const subcommands = (command.options ?? []).filter(
        (o) => o.type === ApplicationCommandOptionType.Subcommand,
      );
      const regularOpts = (command.options ?? []).filter(
        (o) =>
          o.type !== ApplicationCommandOptionType.Subcommand &&
          o.type !== ApplicationCommandOptionType.SubcommandGroup,
      );

      const builder = ui()
        .color(config.colors.default)
        .title(`📖 /${command.name}`)
        .quote(command.description)
        .divider()
        .body(
          `**Usage**\n${command.usage.join("\n")}\n\n**Category**\n${command.category ? command.category.charAt(0).toUpperCase() + command.category.slice(1) : "Misc"}`,
        );

      if (subcommands.length > 0) {
        builder.body(
          `**Subcommands**\n${subcommands
            .map((s) => `\`/${command.name} ${s.name}\` — ${s.description}`)
            .join("\n")}`,
        );
      }
      if (regularOpts.length > 0) {
        builder.body(
          `**Arguments**\n${regularOpts
            .map(
              (opt) =>
                // @ts-ignore
                `\`${opt.name}\` — ${opt.description}${opt.required ? " *(required)*" : ""}`,
            )
            .join("\n")}`,
        );
      }
      if (command.adminOnly) builder.body("**Admin Only:** Yes");
      if (command.devOnly) builder.body("**Dev Only:** Yes");

      builder.footer("Baitin • /help for all commands");

      return ctx.reply(builder.build() as any);
    }

    // Command Center
    const activeTab: CategoryKey = "general";
    const payload = buildPayload(activeTab);

    const { resource } = await ctx.reply({
      ...payload,
      withResponse: true,
    } as any);
    const reply = resource!.message!;

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 5 * 60 * 1000,
      filter: (i) => i.user.id === ctx.user.id,
    });

    collector.on("collect", async (i) => {
      const [, action, value] = i.customId.split(":");

      if (action === "tab") {
        const tab = value as CategoryKey;
        await i.update(buildPayload(tab) as any);
      } else if (action === "cmd") {
        const command = client.commands.get(value);
        if (!command) return i.deferUpdate();

        const infoPayload = ui()
          .color(config.colors.default)
          .title(`📖 /${command.name}`)
          .quote(command.description)
          .body(`**Usage:** ${command.usage.join(", ")}`)
          .footer(`Use /help ${command.name} for full details`)
          .build();

        await i.reply({
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
          components: infoPayload.components,
        } as any);
      }
    });

    collector.on("end", async () => {
      const disabledTabRow =
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          (Object.keys(CATEGORIES) as CategoryKey[]).map((key) =>
            new ButtonBuilder()
              .setCustomId(`help:tab:${key}`)
              .setLabel(CATEGORIES[key].label)
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true),
          ),
        );
      await reply.edit({ components: [disabledTabRow] }).catch(() => {});
    });
  },
} as Command;
