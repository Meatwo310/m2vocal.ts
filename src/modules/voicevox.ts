import {createAudioPlayer, createAudioResource, getVoiceConnection, StreamType} from "@discordjs/voice";
import {Readable} from "node:stream";
import {VoicevoxClient} from "../util/voicevoxClient.js";

if (!VoicevoxClient.baseUrl) {
  console.warn(`VOICEVOX_URL not specified`);
}

class VoicevoxService {
  async speak(guildId: string, text: string): Promise<void> {
    if (!VoicevoxClient.baseUrl) return;
    const voice = getVoiceConnection(guildId);
    if (!voice) return;

    try {
      const query = await VoicevoxClient.createAudioQuery(text, 1);
      const buf = await VoicevoxClient.synthesis(query, 1);
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
