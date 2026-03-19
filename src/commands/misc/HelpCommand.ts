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
import type CoreBot from "@/core/Core";

type CategoryKey = "general" | "economy" | "fishing" | "misc";

const CATEGORY_META: Record<
  CategoryKey,
  { label: string; emoji: string }
> = {
  general: { label: "General", emoji: config.emojis.cat_general },
  economy: { label: "Economy & PvP", emoji: config.emojis.cat_rewards },
  fishing: { label: "Fishing", emoji: config.emojis.cat_fishing },
  misc: { label: "Misc", emoji: config.emojis.cat_games },
};

const CATEGORY_ORDER: CategoryKey[] = ["general", "economy", "fishing", "misc"];

function getCategories(client: CoreBot) {
  const cats: Record<CategoryKey, { name: string; desc: string }[]> = {
    general: [],
    economy: [],
    fishing: [],
    misc: [],
  };

  for (const cmd of client.commands.values()) {
    if (cmd.devOnly || cmd.adminOnly) continue;
    const raw = (cmd.category ?? "misc").toLowerCase();
    const key: CategoryKey = raw in cats ? (raw as CategoryKey) : "misc";
    cats[key].push({ name: cmd.name, desc: cmd.description });
  }

  // Sort each category alphabetically
  for (const key of CATEGORY_ORDER) {
    cats[key].sort((a, b) => a.name.localeCompare(b.name));
  }

  return cats;
}

function buildTabRow(activeTab: CategoryKey): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    CATEGORY_ORDER.map((key) =>
      new ButtonBuilder()
        .setCustomId(`help:tab:${key}`)
        .setLabel(CATEGORY_META[key].label)
        .setStyle(
          key === activeTab ? ButtonStyle.Primary : ButtonStyle.Secondary,
        ),
    ),
  );
}

function buildPayload(activeTab: CategoryKey, client: CoreBot) {
  const cats = getCategories(client);
  const meta = CATEGORY_META[activeTab];
  const commands = cats[activeTab];

  const builder = ui()
    .color(config.colors.default)
    .title(`${meta.emoji} Command Center — ${meta.label}`)
    .quote(
      "Here are Baitin's commands. Use `/help [command]` for full details!",
    )
    .divider();

  for (const cmd of commands) {
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
      .filter((cmd) => cmd.name.toLowerCase() !== "help" && !cmd.devOnly)
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
        .title(`${config.emojis.help} /${command.name}`)
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
    const payload = buildPayload(activeTab, client);

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
        await i.update(buildPayload(tab, client) as any);
      } else if (action === "cmd") {
        const command = client.commands.get(value);
        if (!command) return i.deferUpdate();

        const infoPayload = ui()
          .color(config.colors.default)
          .title(`${config.emojis.help} /${command.name}`)
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
          CATEGORY_ORDER.map((key) =>
            new ButtonBuilder()
              .setCustomId(`help:tab:${key}`)
              .setLabel(CATEGORY_META[key].label)
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true),
          ),
        );
      await reply.edit({ components: [disabledTabRow] }).catch(() => {});
    });
  },
} as Command;
