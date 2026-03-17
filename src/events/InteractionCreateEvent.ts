import {
  type ClientEvents,
  type CommandInteractionOptionResolver,
  type GuildMember,
  type Interaction,
} from "discord.js";
import type { Event, ExtendedInteraction } from "../core/typings";
import { app } from "..";
import config from "../config";
import { defaultEmbeds } from "../core/Embed";

export default {
  name: "interactionCreate",
  run: async (interaction: Interaction) => {
    if (!interaction.guild) return;

    interaction.member = interaction.guild?.members.cache.find(
      (f) => f.id === interaction.user.id,
    ) as GuildMember;

    if (interaction.isCommand() && interaction.guild) {
      const cmdName = interaction.commandName
        ? interaction.commandName.toLowerCase()
        : null;
      if (!cmdName) {
        return interaction.reply({
          content: `${config.emojis.cross} Unable to find command: \`/${cmdName}\``,
          flags: ["Ephemeral"],
        });
      }

      const command = app.commands.get(cmdName);
      if (!command) {
        return interaction.reply({
          content: `${config.emojis.cross} Unable to find command: \`/${cmdName}\``,
          flags: ["Ephemeral"],
        });
      }

      if (
        command.adminOnly &&
        !interaction.member.permissions.has("Administrator")
      ) {
        return interaction.reply({
          flags: ["Ephemeral"],
          embeds: [defaultEmbeds["missing-permissions"]()],
        });
      }

      if (command.devOnly && interaction.user.id !== config.ids.dev) {
        return interaction.reply({
          flags: ["Ephemeral"],
          embeds: [defaultEmbeds["dev-only"]()],
        });
      }

      if (
        command.defaultMemberPermissions &&
        interaction.member.permissions.missing(command.defaultMemberPermissions)
          .length > 0 &&
        !interaction.member.permissions.has("Administrator")
      ) {
        return interaction.reply({
          flags: ["Ephemeral"],
          embeds: [defaultEmbeds["missing-permissions"]()],
        });
      }

      command.run({
        //@ts-ignore
        args: interaction.options as CommandInteractionOptionResolver,
        client: app,
        ctx: interaction as ExtendedInteraction,
      });
    } else if (interaction.isAutocomplete() && interaction.guild) {
      const cmdName = interaction.commandName
        ? interaction.commandName.toLowerCase()
        : null;
      if (!cmdName) {
        return;
      }

      const command = app.commands.get(cmdName);
      if (!command || !command.autocomplete) {
        return;
      }

      command.autocomplete({
        ctx: interaction,
        client: app,
      });
    }
  },
} as Event<keyof ClientEvents>;
