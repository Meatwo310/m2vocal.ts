import {type ArgsOf, Discord, On} from "discordx";
import {bot} from "../bot";
import {isAsciiOnly, romajiToJapanese} from "../util/converter";

@Discord()
export class Conversion {
  @On()
  async messageCreate([message]: ArgsOf<"messageCreate">): Promise<void> {
    if (message.author.id === bot.user?.id) {
      return;
    }

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
