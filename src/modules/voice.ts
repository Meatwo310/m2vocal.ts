import {ArgsOf, Client, Discord, On, Slash, SlashOption} from "discordx";
import {ApplicationCommandOptionType, CommandInteraction, GuildMember, VoiceBasedChannel} from "discord.js";
import {entersState, getVoiceConnection, joinVoiceChannel, VoiceConnectionStatus} from "@discordjs/voice";
import {bot} from "../bot.js";
import {VoicevoxClient} from "../util/voicevoxClient";
import {ttsChannelStore} from "./ttsChannelStore.js";
import {voicevoxService} from "./voicevoxService";
import {deleteGuildSpeaker, deleteUserSpeaker, getGuildSpeaker, getUserSpeaker, resolveGuildSpeakerId, setGuildSpeaker, setUserSpeaker} from "../db/index.js";

@Discord()
export class Voice {
  @Slash({ description: "join" })
  async join(interaction: CommandInteraction): Promise<void> {
    const member = interaction.member;
    const guild = interaction.guild;
    if (!member || !(member instanceof GuildMember) || !guild) {
      await interaction.reply('💥 サーバー情報の取得に失敗しました');
      return;
    }

    const voiceChannel = member.voice?.channel;
    if (!voiceChannel) {
      await interaction.reply('先にVCに入ってください！');
      return;
    }

    await interaction.deferReply();

    const alreadyConnected = voiceChannel.members.has(bot.user?.id || "0")
    const hasAnotherConnection = !!getVoiceConnection(guild.id);
    try {
      await connectWithHandler(voiceChannel);
    } catch {
      await interaction.editReply('❌ VCへの接続に失敗しました');
      return;
    }

    let voicevoxVersion = "";
    try {
      voicevoxVersion = await VoicevoxClient.getVersion();
    } catch (e) {
      console.error(e);
    }

    let message = `✅ ${voiceChannel.name} に`;
    if (alreadyConnected) {
      message += "再接続";
    } else if (hasAnotherConnection) {
      message += "移動";
    } else {
      message += "接続";
    }
    message += "しました！\n"
    if (voicevoxVersion) {
      message += `VOICEVOX: ${voicevoxVersion}`;
    } else {
      message += `VOICEVOX: 利用不可`;
    }
    ttsChannelStore.set(guild.id, interaction.channelId);
    await interaction.editReply(message);

    try {
      const speakerId = resolveGuildSpeakerId(guild.id);
      await voicevoxService.speak(guild.id, `接続しました`, speakerId);
    } catch (e) {
      console.error(e);
    }
  }

  @Slash({ description: "skip" })
  async skip(interaction: CommandInteraction): Promise<void> {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply('💥 サーバー情報の取得に失敗しました');
      return;
    }

    const skipped = voicevoxService.skip(guild.id);
    await interaction.reply({ content: skipped ? '⏭️ スキップしました' : '🤔 スキップするものがありません', fetchReply: false });
  }

  @Slash({ description: "stop" })
  async stop(interaction: CommandInteraction): Promise<void> {
    let guild = interaction.guild;
    if (!guild) {
      await interaction.reply('💥 サーバー情報の取得に失敗しました');
      return;
    }

    const connection = getVoiceConnection(guild.id);
    if (!connection) {
      await interaction.reply('🤔 Botはどのチャンネルにも接続していません');
      return;
    }

    connection.destroy();
    ttsChannelStore.delete(guild.id);
    await interaction.reply('👋 VCから切断しました');
  }

  @Slash({ description: "自分の話者IDを表示・設定します（0でリセット）" })
  async voice(
    @SlashOption({
      name: "speaker_id",
      description: "VOICEVOXの話者ID（省略で現在値を表示、0でリセット）",
      type: ApplicationCommandOptionType.Integer,
      required: false,
    })
    speakerId: number | null,
    interaction: CommandInteraction
  ): Promise<void> {
    const userId = interaction.user.id;
    if (speakerId == null) {
      const current = getUserSpeaker(userId);
      await interaction.reply(current != null
        ? `現在の話者ID: **${current}**`
        : `話者IDは設定されていません`
      );
      return;
    }
    if (speakerId === 0) {
      deleteUserSpeaker(userId);
      await interaction.reply(`🗑️ 話者IDの設定をリセットしました`);
      return;
    }
    setUserSpeaker(userId, speakerId);
    await interaction.reply(`✅ 話者IDを **${speakerId}** に設定しました`);
  }

  @Slash({ name: "voice-default", description: "サーバーのデフォルト話者IDを表示・設定します（0でリセット）" })
  async voiceDefault(
    @SlashOption({
      name: "speaker_id",
      description: "VOICEVOXの話者ID（省略で現在値を表示、0でリセット）",
      type: ApplicationCommandOptionType.Integer,
      required: false,
    })
    speakerId: number | null,
    interaction: CommandInteraction
  ): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply('💥 サーバー情報の取得に失敗しました');
      return;
    }
    const guildId = interaction.guild.id;
    if (speakerId == null) {
      const current = getGuildSpeaker(guildId);
      await interaction.reply(current != null
        ? `現在のデフォルト話者ID: **${current}**`
        : `デフォルト話者IDは設定されていません`
      );
      return;
    }
    if (speakerId === 0) {
      deleteGuildSpeaker(guildId);
      await interaction.reply(`🗑️ デフォルト話者IDの設定をリセットしました`);
      return;
    }
    setGuildSpeaker(guildId, speakerId);
    await interaction.reply(`✅ ギルドのデフォルト話者IDを **${speakerId}** に設定しました`);
  }

  @On({ event: "voiceStateUpdate" })
  async onVoiceStateUpdate([oldState, newState]: ArgsOf<"voiceStateUpdate">, client: Client): Promise<void> {
    if (oldState.channelId === newState.channelId) {
      return;
    }

    const guildId = newState.guild.id;
    const currentChannelId = getVoiceConnection(guildId)?.joinConfig.channelId;
    if (!currentChannelId) {
      return;
    }

    try {
      const speakerId = resolveGuildSpeakerId(guildId);
      if (!newState.channelId && oldState.channelId == currentChannelId && oldState.member && !oldState.member.user.bot) {
        await voicevoxService.speak(guildId, `${oldState.member.displayName}さんが退出しました`, speakerId);
      } else if (!oldState.channelId && newState.channelId === currentChannelId && newState.member && !newState.member.user.bot) {
        await voicevoxService.speak(guildId, `${newState.member.displayName}さんが入室しました`, speakerId);
      }
    } catch (e) {
      console.error(e);
    }

    // 誰かがBotのいるチャンネルから退出した場合、Botのみ残っていれば自動切断
    if (oldState.channelId === currentChannelId && newState.channelId !== currentChannelId) {
      const currentChannel = oldState.channel;
      if (!currentChannel) {
        return;
      }

      const nonBotMembers = currentChannel.members.filter(m => !m.user.bot);
      if (nonBotMembers.size !== 0) {
        return;
      }

      console.log('自動退出: Botのみになったため切断しました');
      const connection = getVoiceConnection(guildId);
      connection?.destroy();
      ttsChannelStore.delete(guildId);
    }
  }
}

/**
 * 接続を作成し、切断ハンドラを付与する
 */
async function connectWithHandler(voiceChannel: VoiceBasedChannel) {
  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
  });

  await entersState(connection, VoiceConnectionStatus.Ready, 10_000);

  connection.on(VoiceConnectionStatus.Disconnected, async (oldState, newState) => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
      console.log('チャンネル移動を検知');
    } catch {
      console.log('強制切断を検知');
      connection.destroy();
    }
  });

  return connection;
}
