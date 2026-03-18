import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
} from "discord.js";

const RESPONSES = [
  // Positive
  "🟢 It is certain.",
  "🟢 It is decidedly so.",
  "🟢 Without a doubt.",
  "🟢 Yes, definitely.",
  "🟢 You may rely on it.",
  "🟢 As I see it, yes.",
  "🟢 Most likely.",
  "🟢 Outlook good.",
  "🟢 Yes.",
  "🟢 Signs point to yes.",
  // Neutral
  "🟡 Reply hazy, try again.",
  "🟡 Ask again later.",
  "🟡 Better not tell you now.",
  "🟡 Cannot predict now.",
  "🟡 Concentrate and ask again.",
  // Negative
  "🔴 Don't count on it.",
  "🔴 My reply is no.",
  "🔴 My sources say no.",
  "🔴 Outlook not so good.",
  "🔴 Very doubtful.",
];

export default {
  name: "8ball",
  description: "Ask the magic 8-ball a question.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/8ball <question>"],
  options: [
    {
      name: "question",
      description: "The question to ask.",
      type: ApplicationCommandOptionType.String,
      required: true,
      maxLength: 200,
    },
  ],
  run: async ({ args, ctx }) => {
    const question = args.getString("question", true);
    const response = RESPONSES[Math.floor(Math.random() * RESPONSES.length)];

    return ctx.reply(
      ui()
        .color(config.colors.default)
        .title("🎱 Magic 8-Ball")
        .body(`> ${question}`)
        .divider()
        .body(response)
        .footer("Baitin • /help")
        .build() as any,
    );
  },
} as Command;
