import {
  ActivityType,
  AutocompleteInteraction,
  CommandInteraction,
  CommandInteractionOptionResolver,
  GuildMember,
  Interaction,
  type ApplicationCommandOptionData,
  type ChatInputApplicationCommandData,
  type ClientEvents,
} from "discord.js";
import type CoreBot from "./Core";

export type Command = {
  run: CommandRunFn;
  adminOnly?: boolean;
  usage: string[];
  category?: string;
  devOnly?: boolean;
  /** If true, the handler defers with Ephemeral. If false/undefined, defers normally. Set to "none" to skip auto-defer (command replies instantly). */
  defer?: boolean | "none";
  autocomplete?: (opts: { ctx: AutocompleteInteraction; client: CoreBot }) => void | Promise<void>;
} & ChatInputApplicationCommandData;

export type CommandRunFn = (opts: CommandRunFnOpts) => void;
export type CommandRunFnOpts = {
  client: CoreBot;
  args: CommandInteractionOptionResolver;
  ctx: ExtendedInteraction;
};
export interface ExtendedInteraction extends CommandInteraction {
  member: GuildMember;
}

export type Event<K extends keyof ClientEvents> = {
  name: K;
  run: (...args: ClientEvents[K]) => void;
};
