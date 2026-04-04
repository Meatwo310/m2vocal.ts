import {type ArgsOf, Discord, Guard, On} from "discordx";
import _VVClient from "voicevox-client";
import {createAudioPlayer, createAudioResource, getVoiceConnection, StreamType} from "@discordjs/voice";
import {Readable} from "node:stream";
import {NotBot} from "@discordx/utilities";

const VVClient = (_VVClient as any).default;

@Discord()
export class Voicevox {
  @On()
  @Guard(NotBot)
  async messageCreate([message]: ArgsOf<"messageCreate">): Promise<void> {
    const guildId = message.guildId;
    if (!guildId) {
      return;
    }

    const voice = getVoiceConnection(guildId);
    if (!voice) {
      return;
    }

    const url = process.env.VOICEVOX_URL;
    if (!url) {
      console.warn(`VOICEVOX_URL not specified`);
      return
    }

    const client: _VVClient = new VVClient(url);
    const msg = message.content;

    try {
      const query = await client.createAudioQuery(msg, 1);
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
