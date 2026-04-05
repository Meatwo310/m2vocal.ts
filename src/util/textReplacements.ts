import type {Message} from "discord.js";

/**
 * TTS読み上げ用にメッセージテキストを前処理する
 * @param message Discordメッセージ（メンション解決・添付ファイル取得に使用）
 * @param textOverride 使用するテキスト（省略時は message.content）
 */
export async function preprocessForTTS(message: Message, textOverride?: string): Promise<string> {
  let text = textOverride ?? message.content;

  // コードブロック → コードブロック省略
  text = text.replace(/```[\s\S]*?```/g, "コードブロック省略");

  // コードスパン → コード省略
  text = text.replace(/`[^`\n]+`/g, "コード省略");

  // Markdownリンク: [表示名](<URL>) → 表示名
  text = text.replace(/\[([^\]]+)\]\(<https?:\/\/[^>]*>\)/g, "$1");

  // Markdownリンク: [表示名](URL) → 表示名
  text = text.replace(/\[([^\]]+)\]\(https?:\/\/[^)]*\)/g, "$1");

  // カスタム絵文字: <a?:name:id> → name
  text = text.replace(/<a?:(\w+):\d+>/g, "$1");

  // メンション: <@!?id> → 表示名
  text = await replaceMentions(message, text);

  // URL (<URL> 形式) → ドメイン
  text = text.replace(/<(https?:\/\/[^\s>]*)>/g, (_, url: string) => urlToDomain(url));

  // ベアURL → ドメイン
  text = text.replace(/https?:\/\/\S+/g, (url) => urlToDomain(url));

  // 添付ファイル
  const attachmentCount = message.attachments.size;
  if (attachmentCount === 1) {
    text = (text.trim() + " 添付ファイル").trim();
  } else if (attachmentCount > 1) {
    text = (text.trim() + ` ${attachmentCount}個の添付ファイル`).trim();
  }

  return text.trim();
}

async function replaceMentions(message: Message, text: string): Promise<string> {
  const mentionRegex = /<@!?(\d+)>/g;
  const matches = [...text.matchAll(mentionRegex)];

  for (const match of matches) {
    const userId = match[1];
    let displayName: string;

    if (message.guild) {
      try {
        const member = await message.guild.members.fetch(userId);
        displayName = member.displayName;
      } catch {
        displayName = `ユーザー${userId}`;
      }
    } else {
      displayName = `ユーザー${userId}`;
    }

    text = text.replace(match[0], displayName);
  }

  return text;
}

function urlToDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/\./g, "ドット");
  } catch {
    return url;
  }
}
