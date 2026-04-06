import {AudioPlayerStatus, createAudioPlayer, createAudioResource, getVoiceConnection, StreamType} from "@discordjs/voice";
import type {AudioPlayer} from "@discordjs/voice";
import {Readable} from "node:stream";
import {VoicevoxClient} from "../util/voicevoxClient.js";

if (!VoicevoxClient.baseUrl) {
  console.warn(`VOICEVOX_URL not specified`);
}

class VoicevoxService {
  private queues = new Map<string, Buffer[]>();
  private players = new Map<string, AudioPlayer>();

  private getOrCreatePlayer(guildId: string): AudioPlayer {
    const existing = this.players.get(guildId);
    if (existing) return existing;

    const player = createAudioPlayer();
    player.on(AudioPlayerStatus.Idle, () => {
      this.playNext(guildId);
    });
    this.players.set(guildId, player);
    return player;
  }

  private playNext(guildId: string): void {
    const queue = this.queues.get(guildId);
    if (!queue || queue.length === 0) return;

    const voice = getVoiceConnection(guildId);
    if (!voice) return;

    const buf = queue.shift()!;
    const player = this.getOrCreatePlayer(guildId);
    const resource = createAudioResource(
      Readable.from(buf),
      {inputType: StreamType.Arbitrary}
    );
    voice.subscribe(player);
    player.play(resource);
  }

  skip(guildId: string): boolean {
    const player = this.players.get(guildId);
    if (player && player.state.status !== AudioPlayerStatus.Idle) {
      player.stop();
      return true;
    }
    return false;
  }

  async speak(guildId: string, text: string): Promise<void> {
    if (!VoicevoxClient.baseUrl) return;
    const voice = getVoiceConnection(guildId);
    if (!voice) return;

    try {
      const query = await VoicevoxClient.createAudioQuery(text, 1);
      const buf = Buffer.from(await VoicevoxClient.synthesis(query, 1));

      if (!this.queues.has(guildId)) {
        this.queues.set(guildId, []);
      }
      this.queues.get(guildId)!.push(buf);

      const player = this.getOrCreatePlayer(guildId);
      if (player.state.status === AudioPlayerStatus.Idle) {
        this.playNext(guildId);
      }
    } catch (e) {
      console.error(e);
    }
  }
}

export const voicevoxService = new VoicevoxService();
