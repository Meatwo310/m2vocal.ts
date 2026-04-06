export type AudioQuery = Record<string, unknown>;

export type SpeakerStyle = {
  name: string;
  id: number;
};

export type Speaker = {
  name: string;
  speaker_uuid: string;
  styles: SpeakerStyle[];
  version: string;
};

export class VoicevoxClient {
  static baseUrl: string | null = process.env.VOICEVOX_URL ?? null;

  static async createAudioQuery(text: string, speaker: number): Promise<AudioQuery> {
    const url = new URL("/audio_query", this.baseUrl!);
    url.searchParams.set("text", text);
    url.searchParams.set("speaker", String(speaker));
    const res = await fetch(url, {method: "POST"});
    if (!res.ok) {
      throw new Error(`VOICEVOX audio_query failed: ${res.status} ${res.statusText}`);
    }
    return res.json();
  }

  static async getSpeakers(): Promise<Speaker[]> {
    const url = new URL("/speakers", this.baseUrl!);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`VOICEVOX speakers failed: ${res.status} ${res.statusText}`);
    }
    return res.json();
  }

  static async getVersion(): Promise<string> {
    const url = new URL("/version", this.baseUrl!);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`VOICEVOX version failed: ${res.status} ${res.statusText}`);
    }
    return res.json();
  }

  static async synthesis(query: AudioQuery, speaker: number): Promise<ArrayBuffer> {
    const url = new URL("/synthesis", this.baseUrl!);
    url.searchParams.set("speaker", String(speaker));
    const res = await fetch(url, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(query),
    });
    if (!res.ok) {
      throw new Error(`VOICEVOX synthesis failed: ${res.status} ${res.statusText}`);
    }
    return res.arrayBuffer();
  }
}
