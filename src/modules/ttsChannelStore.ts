/** guildId -> 読み上げ対象テキストチャンネルID */
const store = new Map<string, string>();

export const ttsChannelStore = {
  set(guildId: string, channelId: string): void {
    store.set(guildId, channelId);
  },
  get(guildId: string): string | undefined {
    return store.get(guildId);
  },
  delete(guildId: string): void {
    store.delete(guildId);
  },
};
