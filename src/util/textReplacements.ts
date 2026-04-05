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

  // チャンネルメンション: <#id> → チャンネル名
  text = await replaceChannelMentions(message, text);

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
  const userIds = [...new Set([...text.matchAll(mentionRegex)].map((m) => m[1]))];
  if (userIds.length === 0) return text;

  // メッセージに付属するキャッシュ済みメンバー情報を優先して使用
  const nameMap = new Map<string, string>();
  const uncachedIds: string[] = [];

  for (const userId of userIds) {
    const cached = message.mentions.members?.get(userId) ?? message.mentions.users.get(userId);
    if (cached) {
      nameMap.set(userId, cached.displayName);
    } else {
      uncachedIds.push(userId);
    }
  }

  // キャッシュにない ID だけ並列 fetch
  if (uncachedIds.length > 0 && message.guild) {
    await Promise.all(
      uncachedIds.map(async (userId) => {
        try {
          const member = await message.guild!.members.fetch(userId);
          nameMap.set(userId, member.displayName);
        } catch {
          nameMap.set(userId, `ユーザー${userId}`);
        }
      })
    );
  }
  for (const userId of uncachedIds) {
    if (!nameMap.has(userId)) nameMap.set(userId, `ユーザー${userId}`);
  }

  return text.replace(mentionRegex, (_, userId: string) => nameMap.get(userId) ?? `ユーザー${userId}`);
}

async function replaceChannelMentions(message: Message, text: string): Promise<string> {
  const channelRegex = /<#(\d+)>/g;
  const channelIds = [...new Set([...text.matchAll(channelRegex)].map((m) => m[1]))];
  if (channelIds.length === 0) return text;

  const nameMap = new Map<string, string>();

  await Promise.all(
    channelIds.map(async (channelId) => {
      try {
        const channel = message.guild?.channels.cache.get(channelId)
          ?? await message.guild?.channels.fetch(channelId);
        if (channel && "name" in channel && channel.name) {
          nameMap.set(channelId, channel.name);
        } else {
          nameMap.set(channelId, `チャンネル${channelId}`);
        }
      } catch {
        nameMap.set(channelId, `チャンネル${channelId}`);
      }
    })
  );

  return text.replace(channelRegex, (_, channelId: string) => nameMap.get(channelId) ?? `チャンネル${channelId}`);
}

function urlToDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/\./g, "ドット");
  } catch {
    return url;
  }
}
