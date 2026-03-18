import {
  type ClientEvents,
  type CommandInteractionOptionResolver,
  type GuildMember,
  type Interaction,
  MessageFlags,
} from "discord.js";
import type { Event, ExtendedInteraction } from "../core/typings";
import { app } from "..";
import config from "../config";
import { defaultEmbeds } from "../core/Embed";
import { err } from "../utils/logger";

export default {
  name: "interactionCreate",
  run: async (interaction: Interaction) => {
    if (!interaction.guild) return;

    interaction.member = (interaction.guild.members.cache.get(
      interaction.user.id,
    ) ?? interaction.member) as GuildMember;

    if (interaction.isCommand() && interaction.guild) {
      const cmdName = interaction.commandName
        ? interaction.commandName.toLowerCase()
        : null;
      if (!cmdName) {
        return interaction.reply({
          content: `${config.emojis.cross} Unable to find command: \`/${cmdName}\``,
          flags: MessageFlags.Ephemeral,
        });
      }

      const command = app.commands.get(cmdName);
      if (!command) {
        return interaction.reply({
          content: `${config.emojis.cross} Unable to find command: \`/${cmdName}\``,
          flags: MessageFlags.Ephemeral,
        });
      }

      if (
        command.adminOnly &&
        !interaction.member.permissions.has("Administrator")
      ) {
        const payload = defaultEmbeds["missing-permissions"]();
        return interaction.reply({
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
          components: payload.components,
        } as any);
      }

      if (command.devOnly && interaction.user.id !== config.ids.dev) {
        const payload = defaultEmbeds["dev-only"]();
        return interaction.reply({
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
          components: payload.components,
        } as any);
      }

      if (
        command.defaultMemberPermissions &&
        interaction.member.permissions.missing(command.defaultMemberPermissions)
          .length > 0 &&
        !interaction.member.permissions.has("Administrator")
      ) {
        const payload = defaultEmbeds["missing-permissions"]();
        return interaction.reply({
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
          components: payload.components,
        } as any);
      }

      try {
        await command.run({
          //@ts-ignore
          args: interaction.options as CommandInteractionOptionResolver,
          client: app,
          ctx: interaction as ExtendedInteraction,
        });
      } catch (e) {
        err(`Command /${cmdName} failed: ${e}`, 0);
        try {
          const content = `${config.emojis.cross} Something went wrong running \`/${cmdName}\`. Please try again.`;
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content });
          } else {
            await interaction.reply({ content, flags: MessageFlags.Ephemeral });
          }
        } catch {}
      }
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

      await Promise.resolve(
        command.autocomplete({
          ctx: interaction,
          client: app,
        }),
      ).catch(() => {});
    } else if(interaction.isButton()) {
      if(interaction.customId === "welcome_get_started") {
        try {
          return await app.commands.get("getting-started")?.run({
            // Cursed but required.
            args: undefined as any,
            client: app,
            ctx: interaction as any
          });
        } catch (e) {
          err(`Button welcome_get_started failed: ${e}`, 0);
        }
      }
    }
  },
} as Event<keyof ClientEvents>;
