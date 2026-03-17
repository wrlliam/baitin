import { defaultEmbeds, Embed } from "@/core/Embed";
import { Command } from "@/core/typings";
import { paginate } from "@/utils/pagination";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
} from "discord.js";

export default {
  name: "help",
  description: "Provides a list of available commands and their descriptions.",
  usage: ["/help", "/help [command]"],
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      name: "command",
      description: "The command to get help for",
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
      .map((cmd) => `${cmd.name}`)
      .toArray();

    const filtered = choices.filter((choice) =>
      choice.toLowerCase().startsWith(focusedValue.toLowerCase()),
    );

    ctx.respond(filtered.map((choice) => ({ name: choice, value: choice })));
  },
  run: async ({ args, client, ctx }) => {
    const commandName = args.getString("command");
    if (commandName) {
      const command = client.commands.get(commandName.toLowerCase());
      if (!command) {
        return ctx.reply({
          embeds: [defaultEmbeds["command-not-found"]()],
        });
      }

      return ctx.reply({
        embeds: [
          new Embed({
            title: `Help - /${command.name}`,
            description: `>>> ${command.description}`,
            fields: [
              {
                name: "Usage",
                value: command.usage.join("\n"),
                inline: true,
              },

              {
                name: "Category",
                value: command.category || "Uncategorized",
                inline: true,
              },
              {
                name: "Arguments",
                value: command.options
                  ? command.options
                      .map(
                        (opt) =>
                          `\`${opt.name}\` - ${opt.description}${
                            //@ts-ignore
                            opt.required ? " (required)" : ""
                          }`,
                      )
                      .join("\n")
                  : "No arguments",
              },
              {
                name: "Admin Only",
                value: command.adminOnly ? "Yes" : "No",
                inline: true,
              },
              {
                name: "Developer Only",
                value: command.devOnly ? "Yes" : "No",
                inline: true,
              },
            ],
          }),
        ],
      });
    } else {
      const commands = client.commands
        .values()
        .map((cmd) => `\`/${cmd.name}\`: ${cmd.description}`)
        .toArray();

      const chunkSize = 5;
      const pages: { embed: Embed }[] = [];
      for (let i = 0; i < commands.length; i += chunkSize) {
        const chunk = commands.slice(i, i + chunkSize);
        pages.push({
          embed: new Embed({
            author: {
              name: `Help - Page ${Math.floor(i / chunkSize) + 1}/${Math.ceil(commands.length / chunkSize)}`,
            },
            description: chunk.join("\n"),
          }),
        });
      }

      await paginate(ctx, pages);
    }
  },
} as Command;
