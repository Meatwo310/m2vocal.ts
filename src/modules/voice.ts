import {ArgsOf, Client, Discord, On, Slash} from "discordx";
import {CommandInteraction, GuildMember, VoiceBasedChannel} from "discord.js";
import {entersState, getVoiceConnection, joinVoiceChannel, VoiceConnectionStatus} from "@discordjs/voice";
import {bot} from "../bot.js";
import {VoicevoxClient} from "../util/voicevoxClient";
import {ttsChannelStore} from "./ttsChannelStore.js";
import {voicevoxService} from "./voicevoxService";

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
      await voicevoxService.speak(guild.id, `接続しました`);
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
      if (!newState.channelId && oldState.channelId == currentChannelId && oldState.member && !oldState.member.user.bot) {
        await voicevoxService.speak(guildId, `${oldState.member.displayName}さんが退出しました`);
      } else if (!oldState.channelId && newState.channelId === currentChannelId && newState.member && !newState.member.user.bot) {
        await voicevoxService.speak(guildId, `${newState.member.displayName}さんが入室しました`);
      }
    } catch (e) {
      console.error(e);
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