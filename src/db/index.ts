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

/** ギルドデフォルト → 1 の順に解決（システムメッセージ用） */
export function resolveGuildSpeakerId(guildId: string): number {
  const guildRow = db.select().from(guildSpeakers).where(eq(guildSpeakers.guildId, guildId)).get();
  return guildRow?.speakerId ?? 1;
}
