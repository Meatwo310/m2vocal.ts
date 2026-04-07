import {type ArgsOf, Discord, Guard, On} from "discordx";
import {NotBot} from "@discordx/utilities";
import {shouldConvert} from "./conversion.js";
import {romajiToJapanese} from "../util/converter.js";
import {voicevoxService} from "./voicevoxService";
import {preprocessForTTS} from "../util/textReplacements.js";
import {ttsChannelStore} from "./ttsChannelStore.js";
import {getGuildDictionary, resolveSpeakerId} from "../db/index.js";

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

    // チャット返信（変換できた場合かつ変換前後でテキストが変わった場合のみ）
    if (converted !== null && converted !== text) {
      await message.reply({ content: converted, allowedMentions: {} }).catch((e) => console.error(e));
    }

    // VC読み上げ（変換結果 or 元テキストをTTS用に前処理）
    if (message.guildId && ttsChannelStore.get(message.guildId) === message.channelId) {
      if (text === 's') {
        voicevoxService.skip(message.guildId);
        return;
      }
      let speakText = await preprocessForTTS(message, converted ?? undefined);
      for (const entry of getGuildDictionary(message.guildId)) {
        speakText = speakText.replaceAll(entry.from, entry.to);
      }
      if (speakText.length > 100) {
        speakText = speakText.slice(0, 90) + "、以下略";
      }
      const speakerId = resolveSpeakerId(message.author.id, message.guildId);
      await voicevoxService.speak(message.guildId, speakText, speakerId);
    }
  }
}
