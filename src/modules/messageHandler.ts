import {type ArgsOf, Discord, Guard, On} from "discordx";
import {NotBot} from "@discordx/utilities";
import {shouldConvert} from "./conversion.js";
import {romajiToJapanese} from "../util/converter.js";
import {voicevoxService} from "./voicevox.js";

@Discord()
export class MessageHandler {
  @On()
  @Guard(NotBot)
  async messageCreate([message]: ArgsOf<"messageCreate">): Promise<void> {
    const text = message.content;

    // 変換を1回だけ実行
    let converted: string | null = null;
    if (shouldConvert(text)) {
      try {
        converted = await romajiToJapanese(text);
      } catch (e) {
        console.error(e);
      }
    }

    // チャット返信（変換できた場合のみ）
    if (converted !== null) {
      await message.reply({ content: converted, allowedMentions: {} }).catch((e) => console.error(e));
    }

    // VC読み上げ（変換結果 or 元テキスト）
    if (message.guildId) {
      let speakText = converted ?? text;
      if (speakText.length > 100) {
        speakText = speakText.slice(0, 90) + "、以下略";
      }
      await voicevoxService.speak(message.guildId, speakText);
    }
  }
}
