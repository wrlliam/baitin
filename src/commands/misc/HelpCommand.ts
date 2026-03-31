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
const CMDS_PER_PAGE = 7;

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

function buildPayload(activeTab: CategoryKey, page: number, client: CoreBot) {
  const cats = getCategories(client);
  const meta = CATEGORY_META[activeTab];
  const commands = cats[activeTab];
  const totalPages = Math.max(1, Math.ceil(commands.length / CMDS_PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const pageCommands = commands.slice(safePage * CMDS_PER_PAGE, (safePage + 1) * CMDS_PER_PAGE);

  const builder = ui()
    .color(config.colors.default)
    .title(`${meta.emoji} Command Center — ${meta.label}`)
    .quote(
      "Here are Baitin's commands. Use `/help [command]` for full details!",
    )
    .divider();

  for (const cmd of pageCommands) {
    builder.section(
      `**/${cmd.name}**\n${cmd.desc}`,
      btn(`/${cmd.name}`, `help:cmd:${cmd.name}`, ButtonStyle.Secondary),
    );
  }

  builder.footer(
    totalPages > 1
      ? `Baitin • /help [command] for detailed info • Page ${safePage + 1}/${totalPages}`
      : "Baitin • /help [command] for detailed info",
  );

  // Build button rows
  const tabRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    CATEGORY_ORDER.map((key) =>
      new ButtonBuilder()
        .setCustomId(`help:tab:${key}`)
        .setLabel(CATEGORY_META[key].label)
        .setStyle(
          key === activeTab ? ButtonStyle.Primary : ButtonStyle.Secondary,
        ),
    ),
  );

  const rows: ActionRowBuilder<ButtonBuilder>[] = [tabRow];

  if (totalPages > 1) {
    const pageRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("help:page:prev")
        .setLabel("◀ Prev")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(safePage === 0),
      new ButtonBuilder()
        .setCustomId("help:page:next")
        .setLabel("Next ▶")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(safePage >= totalPages - 1),
    );
    rows.push(pageRow);
  }

  return { payload: builder.build({ rows }), page: safePage, totalPages };
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
    let activeTab: CategoryKey = "general";
    let currentPage = 0;
    const { payload } = buildPayload(activeTab, currentPage, client);

    const { resource } = await ctx.reply({
      ...payload,
      withResponse: true,
    } as any);
    const reply = resource?.message ?? await ctx.fetchReply();

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 5 * 60 * 1000,
      filter: (i) => i.user.id === ctx.user.id,
    });

    collector.on("collect", async (i) => {
      const [, action, value] = i.customId.split(":");

      if (action === "tab") {
        activeTab = value as CategoryKey;
        currentPage = 0;
        const { payload } = buildPayload(activeTab, currentPage, client);
        await i.update(payload as any);
      } else if (action === "page") {
        if (value === "prev") currentPage = Math.max(0, currentPage - 1);
        else currentPage++;
        const { payload, page } = buildPayload(activeTab, currentPage, client);
        currentPage = page;
        await i.update(payload as any);
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
      const expiredPayload = ui()
        .color(config.colors.default)
        .title(`${CATEGORY_META["general"].emoji} Command Center`)
        .text("This menu has expired. Run \`/help\` again.")
        .build();
      await reply.edit(expiredPayload as any).catch(() => {});
    });
  },
} as Command;
