import { ApplicationCommandOptionType, CommandInteraction, MessageFlags } from "discord.js";
import { Discord, Slash, SlashGroup, SlashOption } from "discordx";
import { deleteDictEntry, getGuildDictionary, setDictEntry } from "../db/index.js";

@Discord()
@SlashGroup({ name: "dict", description: "サーバーの読み上げ辞書を管理します" })
@SlashGroup("dict")
export class Dict {
  @Slash({ description: "辞書エントリを登録します。置き換え先を省略すると削除します" })
  async set(
    @SlashOption({
      name: "from",
      description: "置き換え元のテキスト",
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    from: string,
    @SlashOption({
      name: "to",
      description: "置き換え先のテキスト（省略で削除）",
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    to: string | undefined,
    interaction: CommandInteraction
  ): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: "💥 サーバー情報の取得に失敗しました", flags: MessageFlags.Ephemeral });
      return;
    }
    const guildId = interaction.guild.id;

    if (to == null) {
      const deleted = deleteDictEntry(guildId, from);
      if (deleted) {
        await interaction.reply({ content: `🗑️ 辞書から **${from}** を削除しました` });
      } else {
        await interaction.reply({ content: `🤔 **${from}** は辞書に登録されていません`, flags: MessageFlags.Ephemeral });
      }
      return;
    }

    try {
      new RegExp(from, "g");
    } catch {
      await interaction.reply({ content: `❌ **${from}** は無効な正規表現です`, flags: MessageFlags.Ephemeral });
      return;
    }

    setDictEntry(guildId, from, to);
    await interaction.reply({ content: `✅ \`${from}\` → **${to}** を辞書に登録しました` });
  }

  @Slash({ description: "辞書の一覧を表示します" })
  async list(interaction: CommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: "💥 サーバー情報の取得に失敗しました", flags: MessageFlags.Ephemeral });
      return;
    }
    const entries = getGuildDictionary(interaction.guild.id);

    if (entries.length === 0) {
      await interaction.reply({ content: "📖 辞書にエントリがありません", flags: MessageFlags.Ephemeral });
      return;
    }

    const lines = entries.map(e => `\`${e.from}\` → ${e.to}`);
    const content = `📖 辞書一覧 (${entries.length}件)\n${lines.join("\n")}`;
    await interaction.reply({ content, flags: MessageFlags.Ephemeral });
  }
}
