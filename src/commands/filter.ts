import { ApplicationCommandOptionType, CommandInteraction, MessageFlags } from "discord.js";
import { Discord, Slash, SlashGroup, SlashOption } from "discordx";
import {
  deleteMessageFilter,
  getGuildMessageFilters,
  getMessageFilterRanking,
  setMessageFilter,
} from "../db/index.js";

@Discord()
@SlashGroup({ name: "filter", description: "メッセージフィルタールールを管理します" })
@SlashGroup("filter")
export class Filter {
  @Slash({ description: "フィルタールールを登録します。正規表現を省略すると削除します" })
  async set(
    @SlashOption({
      name: "title",
      description: "フィルターの名前",
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    title: string,
    @SlashOption({
      name: "regex",
      description: "マッチさせる正規表現パターン（省略で削除）",
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    regex: string | undefined,
    interaction: CommandInteraction
  ): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: "💥 サーバー情報の取得に失敗しました", flags: MessageFlags.Ephemeral });
      return;
    }
    const guildId = interaction.guild.id;

    if (regex == null) {
      const deleted = deleteMessageFilter(guildId, title);
      if (deleted) {
        await interaction.reply({ content: `🗑️ フィルター **${title}** を削除しました` });
      } else {
        await interaction.reply({ content: `🤔 **${title}** はフィルターに登録されていません`, flags: MessageFlags.Ephemeral });
      }
      return;
    }

    try {
      new RegExp(regex);
    } catch {
      await interaction.reply({ content: `❌ \`${regex}\` は無効な正規表現です`, flags: MessageFlags.Ephemeral });
      return;
    }

    setMessageFilter(guildId, title, regex);
    await interaction.reply({ content: `✅ フィルター **${title}** (\`${regex}\`) を登録しました` });
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

    const lines = entries.map(e => `**${e.title}** — \`${e.pattern}\``);
    const content = `📋 フィルタールール一覧 (${entries.length}件)\n${lines.join("\n")}`;
    await interaction.reply({ content, flags: MessageFlags.Ephemeral });
  }

  @Slash({ description: "フィルターにマッチしたメッセージのユーザーランキングを表示します" })
  async ranking(
    @SlashOption({
      name: "title",
      description: "ランキングを表示するフィルターの名前",
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    title: string,
    interaction: CommandInteraction
  ): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: "💥 サーバー情報の取得に失敗しました", flags: MessageFlags.Ephemeral });
      return;
    }
    const guildId = interaction.guild.id;

    const filters = getGuildMessageFilters(guildId);
    if (!filters.some(f => f.title === title)) {
      await interaction.reply({ content: `🤔 **${title}** はフィルターに登録されていません`, flags: MessageFlags.Ephemeral });
      return;
    }

    const ranking = getMessageFilterRanking(guildId, title);

    if (ranking.length === 0) {
      await interaction.reply({ content: `📊 **${title}** にまだマッチがありません`, flags: MessageFlags.Ephemeral });
      return;
    }

    const medals = ["🥇", "🥈", "🥉"];
    const total = ranking.reduce((s, r) => s + r.count, 0);
    const lines = ranking.map((r, i) => {
      const prefix = medals[i] ?? `${i + 1}.`;
      return `${prefix} <@${r.userId}> — **${r.count}**回`;
    });
    const content = `📊 **${title}** ランキング (合計 ${total}件)\n${lines.join("\n")}`;
    await interaction.reply({ content, allowedMentions: { parse: [] } });
  }
}
