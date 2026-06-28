import {ArgsOf, ButtonComponent, Client, Discord, On, Slash, SlashOption} from "discordx";
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  CommandInteraction,
  EmbedBuilder,
  Guild,
  GuildMember,
  MessageFlags,
  VoiceBasedChannel
} from "discord.js";
import {entersState, getVoiceConnection, joinVoiceChannel, VoiceConnectionStatus} from "@discordjs/voice";
import {bot} from "../bot.js";
import {Speaker, VoicevoxClient} from "../util/voicevoxClient";
import {ttsChannelStore} from "./ttsChannelStore.js";
import {voicevoxService} from "./voicevoxService";
import {
  deleteVoiceTextLink,
  deleteGuildSpeaker,
  deleteUserSpeaker,
  getGuildSpeaker,
  getUserSpeaker,
  getVoiceTextLink,
  resolveGuildSpeakerId,
  setVoiceTextLink,
  setGuildSpeaker,
  setUserSpeaker
} from "../db/index.js";

const JOIN_LINK_BUTTON_PREFIX = "join-linked-vc:";

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
      await interaction.reply('❌ 先にVCに入ってください！');
      return;
    }

    await interaction.deferReply();
    await joinAndAnnounce(
      voiceChannel,
      (message) => {
        ttsChannelStore.set(guild.id, interaction.channelId);
        return interaction.editReply(message);
      },
      () => interaction.editReply('❌ VCへの接続に失敗しました')
    );
  }

  @Slash({ description: "実行したテキストチャンネルをVCに紐づけます" })
  async link(
    @SlashOption({
      name: "vc",
      description: "紐づけるボイスチャンネル",
      type: ApplicationCommandOptionType.Channel,
      channelTypes: [ChannelType.GuildVoice, ChannelType.GuildStageVoice],
      required: true,
    })
    voiceChannel: VoiceBasedChannel,
    interaction: CommandInteraction
  ): Promise<void> {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply('💥 サーバー情報の取得に失敗しました');
      return;
    }

    const channel = interaction.channel;
    if (!channel || !("isTextBased" in channel) || !channel.isTextBased() || channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice) {
      await interaction.reply({ content: '❌ テキストチャンネルで実行してください', flags: MessageFlags.Ephemeral });
      return;
    }

    setVoiceTextLink(guild.id, voiceChannel.id, interaction.channelId);
    await interaction.reply(`✅ ${voiceChannel.name} に <#${interaction.channelId}> を紐づけました`);
  }

  @Slash({ description: "VCとテキストチャンネルの紐づけを解除します" })
  async unlink(
    @SlashOption({
      name: "vc",
      description: "紐づけを解除するボイスチャンネル",
      type: ApplicationCommandOptionType.Channel,
      channelTypes: [ChannelType.GuildVoice, ChannelType.GuildStageVoice],
      required: true,
    })
    voiceChannel: VoiceBasedChannel,
    interaction: CommandInteraction
  ): Promise<void> {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply('💥 サーバー情報の取得に失敗しました');
      return;
    }

    const deleted = deleteVoiceTextLink(guild.id, voiceChannel.id);
    await interaction.reply(deleted ? `🗑️ ${voiceChannel.name} の紐づけを解除しました` : `🤔 ${voiceChannel.name} は紐づけされていません`);
  }

  @ButtonComponent({ id: new RegExp(`^${JOIN_LINK_BUTTON_PREFIX}`) })
  async joinLinkedVoiceChannel(interaction: ButtonInteraction): Promise<void> {
    const guild = interaction.guild;
    const voiceChannelId = interaction.customId.slice(JOIN_LINK_BUTTON_PREFIX.length);
    if (!guild || !voiceChannelId) {
      await interaction.reply({ content: '💥 サーバー情報の取得に失敗しました', flags: MessageFlags.Ephemeral });
      return;
    }

    const textChannelId = getVoiceTextLink(guild.id, voiceChannelId);
    if (!textChannelId || textChannelId !== interaction.channelId) {
      await interaction.reply({ content: '❌ このボタンの紐づけは現在有効ではありません', flags: MessageFlags.Ephemeral });
      return;
    }

    const channel = await guild.channels.fetch(voiceChannelId).catch(() => null);
    if (!channel?.isVoiceBased()) {
      await interaction.reply({ content: '❌ 紐づけ先のVCが見つかりません', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply();
    await joinAndAnnounce(
      channel,
      (message) => {
        ttsChannelStore.set(guild.id, textChannelId);
        return interaction.editReply(message);
      },
      () => interaction.editReply('❌ VCへの接続に失敗しました')
    );
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

  @Slash({
    description: "Botプロセスを停止します",
    dmPermission: false,
  })
  async reboot(interaction: CommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: '💥 サーバー情報の取得に失敗しました', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.reply('♻️ Botプロセスを停止します');
    setTimeout(() => {
      bot.destroy();
      process.exit(0);
    }, 500).unref();
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
      if (current == null) {
        await interaction.reply(`🤔 話者IDは設定されていません`);
        return;
      }
      await interaction.deferReply();
      const label = await resolveSpeakerLabel(current);
      await interaction.editReply(`🎙️ 現在の話者ID: **${current}**${label}`);
      return;
    }
    if (speakerId === 0) {
      deleteUserSpeaker(userId);
      await interaction.reply(`🗑️ 話者IDの設定をリセットしました`);
      return;
    }
    await interaction.deferReply();
    const speakers = await fetchSpeakersOrNull();
    if (speakers && !findSpeakerStyle(speakers, speakerId)) {
      await interaction.editReply(`❌ 話者ID **${speakerId}** はVOICEVOXに存在しません`);
      return;
    }
    setUserSpeaker(userId, speakerId);
    const label = speakers ? (findSpeakerStyleLabel(speakers, speakerId) ?? "") : "";
    await interaction.editReply(`✅ 話者IDを **${speakerId}**${label} に設定しました`);
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
      if (current == null) {
        await interaction.reply(`🤔 デフォルト話者IDは設定されていません`);
        return;
      }
      await interaction.deferReply();
      const label = await resolveSpeakerLabel(current);
      await interaction.editReply(`🎙️ 現在のデフォルト話者ID: **${current}**${label}`);
      return;
    }
    if (speakerId === 0) {
      deleteGuildSpeaker(guildId);
      await interaction.reply(`🗑️ デフォルト話者IDの設定をリセットしました`);
      return;
    }
    await interaction.deferReply();
    const speakers = await fetchSpeakersOrNull();
    if (speakers && !findSpeakerStyle(speakers, speakerId)) {
      await interaction.editReply(`❌ 話者ID **${speakerId}** はVOICEVOXに存在しません`);
      return;
    }
    setGuildSpeaker(guildId, speakerId);
    const label = speakers ? (findSpeakerStyleLabel(speakers, speakerId) ?? "") : "";
    await interaction.editReply(`✅ ギルドのデフォルト話者IDを **${speakerId}**${label} に設定しました`);
  }

  @Slash({ description: "VOICEVOXの話者一覧を表示します" })
  async speakers(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const speakers = await fetchSpeakersOrNull();
    if (!speakers) {
      await interaction.editReply("❌ VOICEVOXから話者一覧を取得できませんでした");
      return;
    }

    const fields = speakers.map(speaker => ({
      name: speaker.name,
      value: speaker.styles.map(s => `\`${s.id}\` ${s.name}`).join("\n"),
      inline: true,
    }));

    // Embed は最大25フィールド、メッセージは最大10 Embed
    const FIELDS_PER_EMBED = 25;
    const embeds: EmbedBuilder[] = [];
    for (let i = 0; i < fields.length; i += FIELDS_PER_EMBED) {
      const chunk = fields.slice(i, i + FIELDS_PER_EMBED);
      const embed = new EmbedBuilder()
        .setTitle(i === 0 ? "🎙️ VOICEVOX 話者一覧" : null)
        .setColor(0x7289da)
        .addFields(chunk);
      embeds.push(embed);
    }

    await interaction.editReply({ embeds });
  }

  @On({ event: "voiceStateUpdate" })
  async onVoiceStateUpdate([oldState, newState]: ArgsOf<"voiceStateUpdate">, client: Client): Promise<void> {
    if (oldState.channelId === newState.channelId) {
      return;
    }

    const guildId = newState.guild.id;
    const currentChannelId = getVoiceConnection(guildId)?.joinConfig.channelId ?? undefined;
    if (newState.channelId && newState.channel && newState.member && !newState.member.user.bot && isFirstNonBotMember(newState.channel)) {
      await sendLinkedJoinMessage(newState.guild, newState.channelId, newState.member.displayName, currentChannelId);
    }

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
      const textChannelId = ttsChannelStore.get(guildId);
      connection?.destroy();
      ttsChannelStore.delete(guildId);
      await sendAutoDisconnectMessage(newState.guild, textChannelId);
    }
  }
}

function findSpeakerStyle(speakers: Speaker[], styleId: number) {
  for (const speaker of speakers) {
    const style = speaker.styles.find(s => s.id === styleId);
    if (style) return { speaker, style };
  }
  return null;
}

function findSpeakerStyleLabel(speakers: Speaker[], styleId: number): string | null {
  const found = findSpeakerStyle(speakers, styleId);
  return found ? ` (${found.speaker.name} / ${found.style.name})` : null;
}

function isFirstNonBotMember(voiceChannel: VoiceBasedChannel): boolean {
  return voiceChannel.members.filter(member => !member.user.bot).size === 1;
}

async function fetchSpeakersOrNull(): Promise<Speaker[] | null> {
  try {
    return await VoicevoxClient.getSpeakers();
  } catch {
    return null;
  }
}

async function resolveSpeakerLabel(styleId: number): Promise<string> {
  const speakers = await fetchSpeakersOrNull();
  if (!speakers) return "";
  return findSpeakerStyleLabel(speakers, styleId) ?? "";
}

async function sendLinkedJoinMessage(
  guild: Guild,
  voiceChannelId: string,
  displayName: string,
  currentVoiceChannelId: string | undefined
): Promise<void> {
  const textChannelId = getVoiceTextLink(guild.id, voiceChannelId);
  if (!textChannelId) {
    return;
  }

  const textChannel = await guild.channels.fetch(textChannelId).catch(() => null);
  if (!textChannel?.isTextBased() || !("send" in textChannel)) {
    return;
  }

  const isSwitchingVoiceChannel = currentVoiceChannelId != null && currentVoiceChannelId !== voiceChannelId;
  const content = isSwitchingVoiceChannel
    ? `👋 ${displayName}さんが <#${voiceChannelId}> に接続しました\n現在 <#${currentVoiceChannelId}> で読み上げ中ですが、切り替えますか？`
    : `👋 ${displayName}さんが <#${voiceChannelId}> に接続しました`;
  const buttonLabel = isSwitchingVoiceChannel ? "移動して読み上げを開始" : "読み上げを開始";

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${JOIN_LINK_BUTTON_PREFIX}${voiceChannelId}`)
      .setLabel(buttonLabel)
      .setStyle(ButtonStyle.Primary)
  );

  await textChannel.send({
    content,
    components: [row],
  }).catch((e) => console.error(e));
}

async function sendAutoDisconnectMessage(guild: Guild, textChannelId: string | undefined): Promise<void> {
  if (!textChannelId) {
    return;
  }

  const textChannel = await guild.channels.fetch(textChannelId).catch(() => null);
  if (!textChannel?.isTextBased() || !("send" in textChannel)) {
    return;
  }

  await textChannel.send("👋 VCに誰もいなくなったため切断しました").catch((e) => console.error(e));
}

async function joinAndAnnounce(
  voiceChannel: VoiceBasedChannel,
  onSuccess: (message: string) => Promise<unknown>,
  onFailure: () => Promise<unknown>
): Promise<void> {
  const alreadyConnected = voiceChannel.members.has(bot.user?.id || "0");
  const hasAnotherConnection = !!getVoiceConnection(voiceChannel.guild.id);
  try {
    await connectWithHandler(voiceChannel);
  } catch {
    await onFailure();
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
  message += "しました！\n";
  if (voicevoxVersion) {
    message += `VOICEVOX: ${voicevoxVersion}`;
  } else {
    message += `VOICEVOX: 利用不可`;
  }

  await onSuccess(message);

  try {
    const speakerId = resolveGuildSpeakerId(voiceChannel.guild.id);
    await voicevoxService.speak(voiceChannel.guild.id, `接続しました`, speakerId);
  } catch (e) {
    console.error(e);
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
