export type AudioQuery = Record<string, unknown>;

export class VoicevoxClient {
  constructor(private readonly baseUrl: string) {}

  async createAudioQuery(text: string, speaker: number): Promise<AudioQuery> {
    const url = new URL("/audio_query", this.baseUrl);
    url.searchParams.set("text", text);
    url.searchParams.set("speaker", String(speaker));
    const res = await fetch(url, {method: "POST"});
    if (!res.ok) {
      throw new Error(`VOICEVOX audio_query failed: ${res.status} ${res.statusText}`);
    }
    // noinspection ES6MissingAwait
    return res.json();
  }

  async synthesis(query: AudioQuery, speaker: number): Promise<ArrayBuffer> {
    const url = new URL("/synthesis", this.baseUrl);
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
