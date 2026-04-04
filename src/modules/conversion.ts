import {type ArgsOf, Discord, Guard, On} from "discordx";
import {bot} from "../bot";
import {isAsciiOnly, romajiToJapanese} from "../util/converter";
import {NotBot} from "@discordx/utilities";

@Discord()
export class Conversion {
  @On()
  @Guard(NotBot)
  async messageCreate([message]: ArgsOf<"messageCreate">): Promise<void> {
    const text = message.content;
    if (!shouldConvert(text)) {
      return;
    }

    let converted: string;
    try {
      converted = await romajiToJapanese(text);
    } catch (e) {
      console.error(e);
      return;
    }

    await message.reply({ content: converted, allowedMentions: {} });
  }
}

const ignorePattern = /https?:\/\/|<(@|a?:)/;

function shouldConvert(text: string): boolean {
  return isAsciiOnly(text) && !ignorePattern.test(text);
}
