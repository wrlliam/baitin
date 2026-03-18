import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { ApplicationCommandType } from "discord.js";

export default {
  name: "ping",
  description: "Check the bot's latency.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/ping"],
  defer: "none",
  options: [],
  run: async ({ client, ctx }) => {
    const { resource } = await ctx.reply(
      ui().text("Pinging....").build() as any,
    );

    const ws = client.ws.ping;

    return ctx.editReply(
      ui()
        .color(config.colors.default)
        .title("🏓 Pong!")
        .body(`**WebSocket:** ${ws}ms`)
        .footer("Baitin • /help")
        .build() as any,
    );
  },
} as Command;
