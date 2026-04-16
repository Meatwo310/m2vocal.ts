import {
  ApplicationCommandOptionType,
  ChannelType,
  CommandInteraction,
  MessageFlags,
} from "discord.js";
import { Discord, Slash, SlashGroup, SlashOption } from "discordx";
import { deleteMessageFilter, getGuildMessageFilters, setMessageFilter } from "../db/index.js";

@Discord()
@SlashGroup({ name: "filter", description: "メッセージフィルタールールを管理します" })
@SlashGroup("filter")
export class Filter {
  @Slash({ description: "フィルタールールを登録します。転送先チャンネルを省略すると削除します" })
  async set(
    @SlashOption({
      name: "pattern",
      description: "マッチさせる正規表現パターン",
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    pattern: string,
    @SlashOption({
      name: "channel",
      description: "マッチしたメッセージを転送するテキストチャンネル（省略で削除）",
      type: ApplicationCommandOptionType.Channel,
      channelTypes: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
      required: false,
    })
    channel: { id: string } | undefined,
    interaction: CommandInteraction
  ): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: "💥 サーバー情報の取得に失敗しました", flags: MessageFlags.Ephemeral });
      return;
    }
    const guildId = interaction.guild.id;

    if (channel == null) {
      const deleted = deleteMessageFilter(guildId, pattern);
      if (deleted) {
        await interaction.reply({ content: `🗑️ フィルターから \`${pattern}\` を削除しました` });
      } else {
        await interaction.reply({ content: `🤔 \`${pattern}\` はフィルターに登録されていません`, flags: MessageFlags.Ephemeral });
      }
      return;
    }

    try {
      new RegExp(pattern);
    } catch {
      await interaction.reply({ content: `❌ \`${pattern}\` は無効な正規表現です`, flags: MessageFlags.Ephemeral });
      return;
    }

    setMessageFilter(guildId, pattern, channel.id);
    await interaction.reply({ content: `✅ \`${pattern}\` → <#${channel.id}> をフィルターに登録しました` });
  }

  @Slash({ description: "フィルタールールの一覧を表示します" })
  async list(interaction: CommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: "💥 サーバー情報の取得に失敗しました", flags: MessageFlags.Ephemeral });
      return;
    }
    const entries = getGuildMessageFilters(interaction.guild.id);

    if (entries.length === 0) {
      await interaction.reply({ content: "📋 フィルタールールが登録されていません", flags: MessageFlags.Ephemeral });
      return;
    }

    const lines = entries.map(e => `\`${e.pattern}\` → <#${e.channelId}>`);
    const content = `📋 フィルタールール一覧 (${entries.length}件)\n${lines.join("\n")}`;
    await interaction.reply({ content, flags: MessageFlags.Ephemeral });
  }
}
