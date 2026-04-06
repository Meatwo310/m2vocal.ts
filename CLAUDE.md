# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

m2vocal.ts is a Discord TTS (Text-to-Speech) bot that reads messages aloud in voice channels. It converts ASCII romaji input → hiragana → Japanese (via Google Transliteration API), then synthesizes audio via a VOICEVOX Engine instance.

## Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Development server with hot-module reload
pnpm build            # Compile TypeScript to build/
pnpm start            # Run compiled bot (node build/main.js)
```

No test or lint commands are configured.

## Environment Variables

- `BOT_TOKEN` — Discord bot token (required)
- `VOICEVOX_URL` — VOICEVOX Engine base URL (e.g. `http://localhost:50021`); bot warns at startup if unset

## Architecture

```
src/main.ts / src/dev.ts         Entry points (dev.ts adds chokidar hot reload)
src/bot.ts                       Discord client setup (discordx)
src/modules/
  voice.ts                       /join, /skip, /stop slash commands; handles VoiceStateUpdate
  messageHandler.ts              @On(messageCreate) — converts & queues TTS
  voicevoxService.ts             Per-guild audio queue + AudioPlayer management
  conversion.ts                  Decides whether a message needs romaji conversion
  ttsChannelStore.ts             In-memory Map: guildId → active TTS channelId
src/util/
  voicevoxClient.ts              HTTP client for VOICEVOX API (audio_query, synthesis, version)
  converter.ts                   romajiToHiragana (lookup table) + hiraganaToJapanese (Google API)
  conversionTable.ts             Romaji → hiragana lookup table with rewind counts
  textReplacements.ts            Preprocesses Discord messages for TTS readability
```

**Request flow:** `messageHandler` detects ASCII romaji → `converter` converts text → `textReplacements` cleans it → `voicevoxService.speak()` calls VOICEVOX API and streams audio to the voice channel.

## Key Design Details

- Uses **discordx** decorators (`@Discord`, `@Slash`, `@On`) — all command/event classes must be imported via `@discordx/importer` glob in `bot.ts`.
- `voicevoxService` and `ttsChannelStore` are **singletons** (module-level exports); share state across all guild interactions.
- The Google Transliteration endpoint (`www.google.com/transliterate`) is called in parallel chunks — it is an unofficial public API.
- Sending the letter `s` alone in a TTS channel skips the current utterance.
- Docker uses system `ffmpeg` (Alpine apk); locally, `ffmpeg-static` is an optional dep.
- CI (GitHub Actions) only runs `pnpm install` + `pnpm build` — no tests exist.
