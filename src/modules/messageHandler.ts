import {type ArgsOf, Discord, Guard, On} from "discordx";
import {NotBot} from "@discordx/utilities";
import {getVoiceConnection} from "@discordjs/voice";
import {shouldConvert} from "./conversion.js";
import {romajiToJapanese} from "../util/converter.js";
import {voicevoxService} from "./voicevoxService";
import {preprocessForTTS} from "../util/textReplacements.js";
import {ttsChannelStore} from "./ttsChannelStore.js";
import {addMessageFilterHit, getGuildDictionary, getGuildMessageFilters, resolveSpeakerId} from "../db/index.js";

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

    // メッセージフィルタリング（変換後テキスト優先、変換なしなら元テキストで判定）
    if (message.guildId) {
      const filterText = converted ?? text;
      const messageLink = `https://discord.com/channels/${message.guildId}/${message.channelId}/${message.id}`;
      for (const filter of getGuildMessageFilters(message.guildId)) {
        try {
          if (new RegExp(filter.pattern).test(filterText)) {
            addMessageFilterHit(message.guildId, filter.title, message.author.id, messageLink);
          }
        } catch {
          // 無効なパターンはスキップ
        }
      }
    }

    // VC読み上げ（明示指定チャンネル、または接続中VCのチャンネルチャット）
    if (message.guildId && isTtsSourceChannel(message.guildId, message.channelId)) {
      if (text === 's') {
        voicevoxService.skip(message.guildId);
        return;
      }
      let speakText = await preprocessForTTS(message, converted ?? undefined);
      for (const entry of getGuildDictionary(message.guildId)) {
        try {
          speakText = speakText.replace(new RegExp(entry.from, "g"), entry.to);
        } catch {
          // 無効なパターンはスキップ
        }
      }
      if (speakText.length > 100) {
        speakText = speakText.slice(0, 90) + "、以下略";
      }
      const speakerId = resolveSpeakerId(message.author.id, message.guildId);
      await voicevoxService.speak(message.guildId, speakText, speakerId);
    }
  }
}

function isTtsSourceChannel(guildId: string, channelId: string): boolean {
  const explicitTextChannelId = ttsChannelStore.get(guildId);
  const connectedVoiceChannelId = getVoiceConnection(guildId)?.joinConfig.channelId;
  return channelId === explicitTextChannelId || channelId === connectedVoiceChannelId;
}
