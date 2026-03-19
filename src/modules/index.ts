import {
  InteractionReplyOptions,
  InteractionResponse,
  MessageFlags,
  MessagePayload,
} from "discord.js";
import { defaultEmbeds } from "@/core/Embed";
import { errorMsg } from "@/ui";
import config from "../config";
import { Command } from "../core/typings";
import CoreBot from "../core/Core";

export type ModuleValidation = (...any: any) => {
  value: boolean;
  response: InteractionReplyOptions | MessagePayload;
};

export type ModuleBooleanFn = () => boolean;
export type MessageResponse = InteractionReplyOptions | MessagePayload;

export abstract class Module {
  public cleanUp(message: InteractionResponse<boolean>, time = 2500): void {
    const t = setTimeout(() => {
      message.delete();
      clearTimeout(t);
    }, time);
  }

  public valid(cases: ModuleBooleanFn[]): ModuleValidation {
    return (cmd: Command, client: CoreBot) => {
      const payload = defaultEmbeds["missing-values"](cmd, client);
      return {
        value: false,
        response: {
          flags: MessageFlags.Ephemeral,
          components: payload.components,
        } as any,
      };
    };
  }

  public async logic(
    data: any
  ): Promise<InteractionReplyOptions | MessagePayload> {
    const payload = errorMsg(
      "Missing Logic",
      `${config.emojis.cross} It appears that this command is missing its logic? Please try again later.`,
    );
    return {
      components: payload.components,
    } as any;
  }
}

export function moduleValid(value: any, message: string) {
  return value
    ? `${config.emojis.tick} ${message}`
    : `${config.emojis.cross} ${message}`;
}
