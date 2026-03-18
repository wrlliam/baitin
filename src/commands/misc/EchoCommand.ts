import { Command } from "@/core/typings";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
} from "discord.js";

export default {
  name: "echo",
  description: "Echoes the provided message.",
  usage: ["/echo [message]"],
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      name: "message",
      description: "The message to echo",
      type: ApplicationCommandOptionType.String,
      autocomplete: true,
      required: true,
    },
  ],

  run: async ({ args, client, ctx }) => {
    const message = args.getString("message", true);
    ctx.reply({ content: message });
  },
} as Command;
