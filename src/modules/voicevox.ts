import VVClient from "voicevox-client";
import {createAudioPlayer, createAudioResource, getVoiceConnection, StreamType} from "@discordjs/voice";
import {Readable} from "node:stream";

const url = process.env.VOICEVOX_URL;
if (!url) {
  console.warn(`VOICEVOX_URL not specified`);
}

class VoicevoxService {
  private readonly client: VVClient | null = url ? new VVClient(url) : null;

  async speak(guildId: string, text: string): Promise<void> {
    if (!this.client) return;
    const voice = getVoiceConnection(guildId);
    if (!voice) return;

    try {
      const query = await this.client.createAudioQuery(text, 1);
      const buf = await query.synthesis(1);
      const player = createAudioPlayer();
      const resource = createAudioResource(
        Readable.from(Buffer.from(buf)),
        {inputType: StreamType.Arbitrary}
      );
      player.play(resource);
      voice.subscribe(player);
    } catch (e) {
      console.error(e);
    }
  }
}

export const voicevoxService = new VoicevoxService();
