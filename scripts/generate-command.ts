import { writeFile, mkdir } from "node:fs/promises";
import { input, select, confirm } from "@inquirer/prompts";

function capitalise(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

const typeConversionMap: Record<string, string> = {
  ChatInput: "ApplicationCommandType.ChatInput",
  User: "ApplicationCommandType.User",
  Message: "ApplicationCommandType.Message",
  String: "ApplicationCommandOptionType.String",
  Integer: "ApplicationCommandOptionType.Integer",
  Boolean: "ApplicationCommandOptionType.Boolean",
  Channel: "ApplicationCommandOptionType.Channel",
  Role: "ApplicationCommandOptionType.Role",
  Mentionable: "ApplicationCommandOptionType.Mentionable",
  Number: "ApplicationCommandOptionType.Number",
};

interface CommandOption {
  name: string;
  description: string;
  type: string;
  required: boolean;
}

export default async function generateCommand() {
  console.log("\n  Welcome to the Command Generator!\n");

  const name = await input({
    message: "Enter the command name (e.g., 'echo'):",
    validate: (value) => {
      if (!value.length) return "Command name cannot be empty.";
      if (!/^[\w-]+$/.test(value))
        return "Command name can only contain letters, numbers, underscores, and hyphens.";
      return true;
    },
  });

  const description = await input({
    message: "Enter the command description:",
    validate: (value) => {
      if (!value.length) return "Command description cannot be empty.";
      return true;
    },
  });

  const type = await select({
    message: "Select the command type:",
    choices: [
      { value: "ChatInput", name: "Chat Input (Slash Command)" },
      { value: "User", name: "User Command" },
      { value: "Message", name: "Message Command" },
    ],
  });

  const category = await input({
    message: "Enter the command category (optional):",
    default: "Uncategorized",
    validate: (value) => {
      if (value && !/^[\w\s-]+$/.test(value))
        return "Category can only contain letters, numbers, spaces, underscores, and hyphens.";
      return true;
    },
  });

  const usage = await input({
    message: "Enter the command usage (e.g., '/echo [message]'):",
    validate: (value) => {
      if (!value.length) return "Command usage cannot be empty.";
      return true;
    },
  });

  const options: CommandOption[] = [];

  while (true) {
    const addOption = await confirm({
      message: `Add an option to this command?${options.length ? ` (${options.length} added so far)` : ""}`,
      default: false,
    });

    if (!addOption) break;

    const optionName = await input({
      message: "Option name:",
      validate: (value) => {
        if (!value.length) return "Option name cannot be empty.";
        if (!/^[\w-]+$/.test(value))
          return "Option name can only contain letters, numbers, underscores, and hyphens.";
        return true;
      },
    });

    const optionDescription = await input({
      message: "Option description:",
      validate: (value) => {
        if (!value.length) return "Option description cannot be empty.";
        return true;
      },
    });

    const optionType = await select({
      message: "Option type:",
      choices: [
        { value: "String", name: "String" },
        { value: "Integer", name: "Integer" },
        { value: "Boolean", name: "Boolean" },
        { value: "User", name: "User" },
        { value: "Channel", name: "Channel" },
        { value: "Role", name: "Role" },
        { value: "Mentionable", name: "Mentionable" },
        { value: "Number", name: "Number" },
      ],
    });

    const optionRequired = await confirm({
      message: "Is this option required?",
      default: false,
    });

    options.push({
      name: optionName,
      description: optionDescription,
      type:
        typeConversionMap[optionType] ?? "ApplicationCommandOptionType.String",
      required: optionRequired,
    });
  }

  const commandType =
    typeConversionMap[type] ?? "ApplicationCommandType.ChatInput";
  const outputDir = `./src/commands/${category.toLowerCase()}`;
  const outputPath = `${outputDir}/${capitalise(name)}Command.ts`;

  const shouldProceed = await confirm({
    message: `Generate ${outputPath}?`,
    default: true,
  });

  if (!shouldProceed) {
    console.log("\n  Cancelled.\n");
    process.exit(0);
  }

  const commandData = `import { Command } from "@/core/typings";
import { ApplicationCommandOptionType, ApplicationCommandType } from "discord.js";

export default {
  name: "${name.toLowerCase()}",
  description: "${description}",
  type: ${commandType},
  usage: ["${usage}"],
  options: ${JSON.stringify(options, null, 2)},
  run: async ({ args, client, ctx }) => {
    // Your command logic here
  },
} as Command;
`;

  try {
    await mkdir(outputDir, { recursive: true });
    await writeFile(outputPath, commandData);
    console.log(`\n  ✔ Command file generated: ${outputPath}\n`);
  } catch (err) {
    console.error("\n  ✖ Failed to generate command file.\n", err);
    process.exit(1);
  }
}

generateCommand();
