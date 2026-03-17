import { writeFile } from "node:fs/promises";
import search from "@inquirer/search";
import { confirm } from "@inquirer/prompts";

function capitalise(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export const clientEventsArray = [
  {
    label: "applicationCommandPermissionsUpdate",
    args: ["data: ApplicationCommandPermissionsUpdateData"],
  },
  {
    label: "autoModerationActionExecution",
    args: ["autoModerationActionExecution: AutoModerationActionExecution"],
  },
  {
    label: "autoModerationRuleCreate",
    args: ["autoModerationRule: AutoModerationRule"],
  },
  {
    label: "autoModerationRuleDelete",
    args: ["autoModerationRule: AutoModerationRule"],
  },
  {
    label: "autoModerationRuleUpdate",
    args: [
      "oldAutoModerationRule: AutoModerationRule | null",
      "newAutoModerationRule: AutoModerationRule",
    ],
  },
  { label: "cacheSweep", args: ["message: string"] },
  { label: "channelCreate", args: ["channel: NonThreadGuildBasedChannel"] },
  {
    label: "channelDelete",
    args: ["channel: DMChannel | NonThreadGuildBasedChannel"],
  },
  {
    label: "channelPinsUpdate",
    args: ["channel: TextBasedChannel", "date: Date"],
  },
  {
    label: "channelUpdate",
    args: [
      "oldChannel: DMChannel | NonThreadGuildBasedChannel",
      "newChannel: DMChannel | NonThreadGuildBasedChannel",
    ],
  },
  { label: "clientReady", args: ["client: Client<true>"] },
  { label: "debug", args: ["message: string"] },
  { label: "warn", args: ["message: string"] },
  { label: "emojiCreate", args: ["emoji: GuildEmoji"] },
  { label: "emojiDelete", args: ["emoji: GuildEmoji"] },
  {
    label: "emojiUpdate",
    args: ["oldEmoji: GuildEmoji", "newEmoji: GuildEmoji"],
  },
  { label: "entitlementCreate", args: ["entitlement: Entitlement"] },
  { label: "entitlementDelete", args: ["entitlement: Entitlement"] },
  {
    label: "entitlementUpdate",
    args: ["oldEntitlement: Entitlement | null", "newEntitlement: Entitlement"],
  },
  { label: "error", args: ["error: Error"] },
  {
    label: "guildAuditLogEntryCreate",
    args: ["auditLogEntry: GuildAuditLogsEntry", "guild: Guild"],
  },
  { label: "guildAvailable", args: ["guild: Guild"] },
  { label: "guildBanAdd", args: ["ban: GuildBan"] },
  { label: "guildBanRemove", args: ["ban: GuildBan"] },
  { label: "guildCreate", args: ["guild: Guild"] },
  { label: "guildDelete", args: ["guild: Guild"] },
  { label: "guildUnavailable", args: ["guild: Guild"] },
  { label: "guildIntegrationsUpdate", args: ["guild: Guild"] },
  { label: "guildMemberAdd", args: ["member: GuildMember"] },
  {
    label: "guildMemberAvailable",
    args: ["member: GuildMember | PartialGuildMember"],
  },
  {
    label: "guildMemberRemove",
    args: ["member: GuildMember | PartialGuildMember"],
  },
  {
    label: "guildMembersChunk",
    args: [
      "members: ReadonlyCollection<Snowflake, GuildMember>",
      "guild: Guild",
      "data: GuildMembersChunk",
    ],
  },
  {
    label: "guildMemberUpdate",
    args: [
      "oldMember: GuildMember | PartialGuildMember",
      "newMember: GuildMember",
    ],
  },
  { label: "guildUpdate", args: ["oldGuild: Guild", "newGuild: Guild"] },
  {
    label: "guildSoundboardSoundCreate",
    args: ["soundboardSound: GuildSoundboardSound"],
  },
  {
    label: "guildSoundboardSoundDelete",
    args: ["soundboardSound: GuildSoundboardSound | PartialSoundboardSound"],
  },
  {
    label: "guildSoundboardSoundUpdate",
    args: [
      "oldSoundboardSound: GuildSoundboardSound | null",
      "newSoundboardSound: GuildSoundboardSound",
    ],
  },
  {
    label: "guildSoundboardSoundsUpdate",
    args: [
      "soundboardSounds: ReadonlyCollection<Snowflake, GuildSoundboardSound>",
      "guild: Guild",
    ],
  },
  { label: "inviteCreate", args: ["invite: Invite"] },
  { label: "inviteDelete", args: ["invite: Invite"] },
  {
    label: "messageCreate",
    args: ["message: OmitPartialGroupDMChannel<Message>"],
  },
  {
    label: "messageDelete",
    args: ["message: OmitPartialGroupDMChannel<Message | PartialMessage>"],
  },
  {
    label: "messagePollVoteAdd",
    args: ["pollAnswer: PollAnswer | PartialPollAnswer", "userId: Snowflake"],
  },
  {
    label: "messagePollVoteRemove",
    args: ["pollAnswer: PollAnswer | PartialPollAnswer", "userId: Snowflake"],
  },
  {
    label: "messageReactionRemoveAll",
    args: [
      "message: OmitPartialGroupDMChannel<Message | PartialMessage>",
      "reactions: ReadonlyCollection<string | Snowflake, MessageReaction>",
    ],
  },
  {
    label: "messageReactionRemoveEmoji",
    args: ["reaction: MessageReaction | PartialMessageReaction"],
  },
  {
    label: "messageDeleteBulk",
    args: [
      "messages: ReadonlyCollection<Snowflake, Message<true> | PartialMessage<true>>",
      "channel: GuildTextBasedChannel",
    ],
  },
  {
    label: "messageReactionAdd",
    args: [
      "reaction: MessageReaction | PartialMessageReaction",
      "user: User | PartialUser",
      "details: MessageReactionEventDetails",
    ],
  },
  {
    label: "messageReactionRemove",
    args: [
      "reaction: MessageReaction | PartialMessageReaction",
      "user: User | PartialUser",
      "details: MessageReactionEventDetails",
    ],
  },
  {
    label: "messageUpdate",
    args: [
      "oldMessage: OmitPartialGroupDMChannel<Message | PartialMessage>",
      "newMessage: OmitPartialGroupDMChannel<Message>",
    ],
  },
  {
    label: "presenceUpdate",
    args: ["oldPresence: Presence | null", "newPresence: Presence"],
  },
  { label: "ready", args: ["client: Client<true>"] },
  { label: "invalidated", args: [] },
  { label: "roleCreate", args: ["role: Role"] },
  { label: "roleDelete", args: ["role: Role"] },
  { label: "roleUpdate", args: ["oldRole: Role", "newRole: Role"] },
  {
    label: "threadCreate",
    args: ["thread: AnyThreadChannel", "newlyCreated: boolean"],
  },
  { label: "threadDelete", args: ["thread: AnyThreadChannel"] },
  {
    label: "threadListSync",
    args: [
      "threads: ReadonlyCollection<Snowflake, AnyThreadChannel>",
      "guild: Guild",
    ],
  },
  {
    label: "threadMemberUpdate",
    args: ["oldMember: ThreadMember", "newMember: ThreadMember"],
  },
  {
    label: "threadMembersUpdate",
    args: [
      "addedMembers: ReadonlyCollection<Snowflake, ThreadMember>",
      "removedMembers: ReadonlyCollection<Snowflake, ThreadMember | PartialThreadMember>",
      "thread: AnyThreadChannel",
    ],
  },
  {
    label: "threadUpdate",
    args: ["oldThread: AnyThreadChannel", "newThread: AnyThreadChannel"],
  },
  { label: "typingStart", args: ["typing: Typing"] },
  {
    label: "userUpdate",
    args: ["oldUser: User | PartialUser", "newUser: User"],
  },
  {
    label: "voiceChannelEffectSend",
    args: ["voiceChannelEffect: VoiceChannelEffect"],
  },
  {
    label: "voiceStateUpdate",
    args: ["oldState: VoiceState", "newState: VoiceState"],
  },
  {
    label: "webhookUpdate",
    args: [
      "channel: TextChannel | NewsChannel | VoiceChannel | ForumChannel | MediaChannel",
    ],
  },
  {
    label: "webhooksUpdate",
    args: [
      "channel: TextChannel | NewsChannel | VoiceChannel | ForumChannel | MediaChannel",
    ],
  },
  { label: "interactionCreate", args: ["interaction: Interaction"] },
  {
    label: "shardDisconnect",
    args: ["closeEvent: CloseEvent", "shardId: number"],
  },
  { label: "shardError", args: ["error: Error", "shardId: number"] },
  {
    label: "shardReady",
    args: ["shardId: number", "unavailableGuilds: Set<Snowflake> | undefined"],
  },
  { label: "shardReconnecting", args: ["shardId: number"] },
  { label: "shardResume", args: ["shardId: number", "replayedEvents: number"] },
  { label: "stageInstanceCreate", args: ["stageInstance: StageInstance"] },
  {
    label: "stageInstanceUpdate",
    args: [
      "oldStageInstance: StageInstance | null",
      "newStageInstance: StageInstance",
    ],
  },
  { label: "stageInstanceDelete", args: ["stageInstance: StageInstance"] },
  { label: "stickerCreate", args: ["sticker: Sticker"] },
  { label: "stickerDelete", args: ["sticker: Sticker"] },
  {
    label: "stickerUpdate",
    args: ["oldSticker: Sticker", "newSticker: Sticker"],
  },
  { label: "subscriptionCreate", args: ["subscription: Subscription"] },
  { label: "subscriptionDelete", args: ["subscription: Subscription"] },
  {
    label: "subscriptionUpdate",
    args: [
      "oldSubscription: Subscription | null",
      "newSubscription: Subscription",
    ],
  },
  {
    label: "guildScheduledEventCreate",
    args: ["guildScheduledEvent: GuildScheduledEvent"],
  },
  {
    label: "guildScheduledEventUpdate",
    args: [
      "oldGuildScheduledEvent: GuildScheduledEvent | PartialGuildScheduledEvent | null",
      "newGuildScheduledEvent: GuildScheduledEvent",
    ],
  },
  {
    label: "guildScheduledEventDelete",
    args: [
      "guildScheduledEvent: GuildScheduledEvent | PartialGuildScheduledEvent",
    ],
  },
  {
    label: "guildScheduledEventUserAdd",
    args: [
      "guildScheduledEvent: GuildScheduledEvent | PartialGuildScheduledEvent",
      "user: User",
    ],
  },
  {
    label: "guildScheduledEventUserRemove",
    args: [
      "guildScheduledEvent: GuildScheduledEvent | PartialGuildScheduledEvent",
      "user: User",
    ],
  },
  {
    label: "soundboardSounds",
    args: [
      "soundboardSounds: ReadonlyCollection<Snowflake, GuildSoundboardSound>",
      "guild: Guild",
    ],
  },
];

function extractTypes(args: string[]): string[] {
  return args.flatMap((arg) => {
    const colonIndex = arg.indexOf(":");
    if (colonIndex === -1) return [];
    const typeStr = arg.slice(colonIndex + 1).trim();

    return typeStr
      .split(/\s*\|\s*/)
      .map((t) => t.trim())
      .filter(
        (t) =>
          t &&
          t !== "null" &&
          t !== "undefined" &&
          t !== "boolean" &&
          t !== "number" &&
          t !== "string",
      );
  });
}

export async function generateEvent() {
  console.log("\n  Welcome to the Event Generator!\n");

  const name = await search({
    message: "Select an event:",
    source: (input) => {
      const filtered = input
        ? clientEventsArray.filter((v) =>
            v.label.toLowerCase().includes(input.toLowerCase()),
          )
        : clientEventsArray;

      return filtered.map((v) => ({
        value: v.label,
        name: capitalise(v.label),
        description: v.args.length ? v.args.join(", ") : "no arguments",
      }));
    },
  });

  const event = clientEventsArray.find((v) => v.label === name)!;
  const outputPath = `./src/events/${capitalise(name)}Event.ts`;

  const shouldProceed = await confirm({
    message: `Generate ${outputPath}?`,
    default: true,
  });

  if (!shouldProceed) {
    console.log("\n  Cancelled.\n");
    process.exit(0);
  }

  const uniqueTypes = [...new Set(extractTypes(event.args))];

  const eventTypeImports =
    uniqueTypes.length > 0
      ? `import { ClientEvents, ${uniqueTypes.join(", ")} } from "discord.js";`
      : 'import { ClientEvents } from "discord.js";';

  const eventData = `import { Event } from "@/core/typings";
${eventTypeImports}

export default {
  name: "${name}",
  run: async (${event.args.join(", ")}) => {
    // Your event logic here
  },
} as Event<keyof ClientEvents>;
`;

  try {
    await writeFile(outputPath, eventData);
    console.log(`\n  ✔ Event file generated: ${outputPath}\n`);
  } catch (err) {
    console.error("\n  ✖ Failed to generate event file.\n", err);
    process.exit(1);
  }
}

generateEvent();
