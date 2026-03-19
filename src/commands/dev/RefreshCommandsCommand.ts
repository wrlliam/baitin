import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { app } from "@/index";
import { env } from "@/env";
import { ApplicationCommandType, PermissionFlagsBits, REST, Routes } from "discord.js";

export default {
  name: "refresh-commands",
  description: "Re-register all slash commands with Discord.",
  type: ApplicationCommandType.ChatInput,
  devOnly: true,
  defer: true,
  usage: ["/refresh-commands"],
  options: [],
  run: async ({ ctx }) => {
    await ctx.editReply(
      ui()
        .color(0xffa500)
        .title(`${config.emojis.refresh} Refreshing Commands...`)
        .body("Re-registering all slash commands, please wait.")
        .build() as any,
    );

    const commandList = Array.from(app.commands.values()).map((cmd) => {
      const data: any = { ...cmd };
      delete data.run;
      delete data.autocomplete;
      delete data.category;
      delete data.usage;
      delete data.devOnly;
      delete data.adminOnly;
      delete data.defer;
      if (cmd.adminOnly) {
        data.defaultMemberPermissions = PermissionFlagsBits.Administrator.toString();
      } else if (cmd.devOnly) {
        data.defaultMemberPermissions = "0";
      }
      return data;
    });

    try {
      const rest = new REST().setToken(process.env.TOKEN!);
      const guilds = env.GUILD_ID ? env.GUILD_ID.split(",") : [];

      if (guilds.length === 0) {
        const data = await rest.put(
          Routes.applicationCommands(env.DISCORD_CLIENT_ID!),
          { body: commandList },
        ) as any[];
        await ctx.editReply(
          ui()
            .color(0x00ff00)
            .title(`${config.emojis.tick} Commands Refreshed (Global)`)
            .body(`Registered **${data.length}** commands globally.`)
            .build() as any,
        );
      } else {
        await Promise.all(
          guilds.map((guildId) =>
            rest.put(
              Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID!, guildId.trim()),
              { body: commandList },
            ),
          ),
        );
        await ctx.editReply(
          ui()
            .color(0x00ff00)
            .title(`${config.emojis.tick} Commands Refreshed`)
            .body(
              `Registered **${commandList.length}** commands in **${guilds.length}** guild${guilds.length > 1 ? "s" : ""}.`,
            )
            .build() as any,
        );
      }
    } catch (e) {
      await ctx.editReply(
        ui()
          .color(0xff0000)
          .title(`${config.emojis.cross} Refresh Failed`)
          .body(`\`\`\`\n${e}\n\`\`\``)
          .build() as any,
      );
    }
  },
} as Command;
