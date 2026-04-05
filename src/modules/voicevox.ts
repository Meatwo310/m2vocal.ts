import {createAudioPlayer, createAudioResource, getVoiceConnection, StreamType} from "@discordjs/voice";
import {Readable} from "node:stream";
import {VoicevoxClient} from "../util/voicevoxClient.js";

const url = process.env.VOICEVOX_URL;
if (!url) {
  console.warn(`VOICEVOX_URL not specified`);
}

class VoicevoxService {
  private readonly client: VoicevoxClient | null = url ? new VoicevoxClient(url) : null;

  async speak(guildId: string, text: string): Promise<void> {
    if (!this.client) return;
    const voice = getVoiceConnection(guildId);
    if (!voice) return;

    try {
      const query = await this.client.createAudioQuery(text, 1);
      const buf = await this.client.synthesis(query, 1);
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
