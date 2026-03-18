import config from "../config";
import CoreBot from "./Core";
import { Command } from "./typings";
import { err } from "@/utils";
import { ui, errorMsg, type UIPayload } from "@/ui";
import chalk from "chalk";

export const defaultEmbeds = {
  "command-not-found": (): UIPayload =>
    errorMsg(
      "Command Not Found",
      `${config.emojis.cross} I couldn't find that command. Use \`/help\` to see all available commands.`,
    ),
  "missing-values": (cmd: Command, client: CoreBot): UIPayload =>
    ui()
      .color(config.colors.default)
      .title("Invalid/Missing Arguments")
      .body(
        `${config.emojis.cross} Please check your arguments and ensure all required forms are provided.`,
      )
      .footer(`Need more help? /help ${cmd.name}`)
      .build(),
  "dev-only": (): UIPayload =>
    errorMsg(
      "Insignificant Permissions",
      `${config.emojis.mod} This is a developer only command.`,
    ),
  "missing-permissions": (): UIPayload =>
    errorMsg(
      "Insignificant Permissions",
      `${config.emojis.mod} You are missing the required permissions to use this command.`,
    ),
  "unexpected-error": (error?: Error, extended?: string): UIPayload => {
    if (error)
      err(
        `(${error.cause} ${error.stack}) ${chalk.bold(chalk.yellow(error.name))}\n${error.message}`,
      );
    return errorMsg(
      "An unexpected error occurred.",
      `${config.emojis.cross} An unexpected error occurred. Please report this in my [support server](${config.support}) to my team.`,
    );
  },
};
