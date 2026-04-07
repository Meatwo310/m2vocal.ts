import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import * as schema from "./schema.js";
import { guildSpeakers, userSpeakers } from "./schema.js";

const sqlite = new Database("data.db");
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS user_speakers (
    user_id TEXT PRIMARY KEY,
    speaker_id INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS guild_speakers (
    guild_id TEXT PRIMARY KEY,
    speaker_id INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS guild_dictionary (
    guild_id TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    PRIMARY KEY (guild_id, "from")
  );
`);

export const db = drizzle(sqlite, { schema });

export function getUserSpeaker(userId: string): number | null {
  const row = db.select().from(userSpeakers).where(eq(userSpeakers.userId, userId)).get();
  return row?.speakerId ?? null;
}

export function getGuildSpeaker(guildId: string): number | null {
  const row = db.select().from(guildSpeakers).where(eq(guildSpeakers.guildId, guildId)).get();
  return row?.speakerId ?? null;
}

export function setUserSpeaker(userId: string, speakerId: number): void {
  db.insert(userSpeakers)
    .values({ userId, speakerId })
    .onConflictDoUpdate({ target: userSpeakers.userId, set: { speakerId } })
    .run();
}

export function setGuildSpeaker(guildId: string, speakerId: number): void {
  db.insert(guildSpeakers)
    .values({ guildId, speakerId })
    .onConflictDoUpdate({ target: guildSpeakers.guildId, set: { speakerId } })
    .run();
}

export function deleteUserSpeaker(userId: string): void {
  db.delete(userSpeakers).where(eq(userSpeakers.userId, userId)).run();
}

export function deleteGuildSpeaker(guildId: string): void {
  db.delete(guildSpeakers).where(eq(guildSpeakers.guildId, guildId)).run();
}

/** ユーザー設定 → ギルドデフォルト → 1 の順に解決 */
export function resolveSpeakerId(userId: string, guildId: string): number {
  const userRow = db.select().from(userSpeakers).where(eq(userSpeakers.userId, userId)).get();
  if (userRow) return userRow.speakerId;

  const guildRow = db.select().from(guildSpeakers).where(eq(guildSpeakers.guildId, guildId)).get();
  if (guildRow) return guildRow.speakerId;

  return 1;
}

export function getGuildDictionary(guildId: string): { from: string; to: string }[] {
  return sqlite
    .prepare(`SELECT "from", "to" FROM guild_dictionary WHERE guild_id = ? ORDER BY "from"`)
    .all(guildId) as { from: string; to: string }[];
}

export function setDictEntry(guildId: string, from: string, to: string): void {
  sqlite
    .prepare(
      `INSERT INTO guild_dictionary (guild_id, "from", "to") VALUES (?, ?, ?)
       ON CONFLICT(guild_id, "from") DO UPDATE SET "to" = excluded."to"`
    )
    .run(guildId, from, to);
}

/** @returns 削除された場合 true */
export function deleteDictEntry(guildId: string, from: string): boolean {
  const result = sqlite
    .prepare(`DELETE FROM guild_dictionary WHERE guild_id = ? AND "from" = ?`)
    .run(guildId, from);
  return result.changes > 0;
}

/** ギルドデフォルト → 1 の順に解決（システムメッセージ用） */
export function resolveGuildSpeakerId(guildId: string): number {
  const guildRow = db.select().from(guildSpeakers).where(eq(guildSpeakers.guildId, guildId)).get();
  return guildRow?.speakerId ?? 1;
}
