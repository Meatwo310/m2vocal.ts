import {Discord, Slash} from "discordx";
import {CommandInteraction, GuildMember, VoiceBasedChannel} from "discord.js";
import {entersState, getVoiceConnection, joinVoiceChannel, VoiceConnectionStatus} from "@discordjs/voice";
import {bot} from "../bot.js";

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

    const alreadyConnected = voiceChannel.members.has(bot.user?.id || "0")
    const hasAnotherConnection = !!getVoiceConnection(guild.id);
    try {
      await connectWithHandler(voiceChannel);
      if (alreadyConnected) {
        await interaction.reply(`✅ ${voiceChannel.name} に再接続しました！`);
      } else if (hasAnotherConnection) {
        await interaction.reply(`✅ ${voiceChannel.name} に移動しました！`);
      } else {
        await interaction.reply(`✅ ${voiceChannel.name} に接続しました！`);
      }
    } catch {
      await interaction.reply('❌ VCへの接続に失敗しました');
    }
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
    await interaction.reply('👋 VCから切断しました');
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