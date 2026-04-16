import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { and, count, desc, eq } from "drizzle-orm";
import * as schema from "./schema.js";
import {
  guildDictionary,
  guildMessageFilterHits,
  guildMessageFilters,
  guildSpeakers,
  userSpeakers,
} from "./schema.js";

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
  CREATE TABLE IF NOT EXISTS guild_message_filters (
    guild_id TEXT NOT NULL,
    title TEXT NOT NULL,
    pattern TEXT NOT NULL,
    PRIMARY KEY (guild_id, title)
  );
  CREATE TABLE IF NOT EXISTS guild_message_filter_hits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    title TEXT NOT NULL,
    user_id TEXT NOT NULL,
    message_link TEXT NOT NULL
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
  return db
    .select({ from: guildDictionary.from, to: guildDictionary.to })
    .from(guildDictionary)
    .where(eq(guildDictionary.guildId, guildId))
    .orderBy(guildDictionary.from)
    .all();
}

export function setDictEntry(guildId: string, from: string, to: string): void {
  db.insert(guildDictionary)
    .values({ guildId, from, to })
    .onConflictDoUpdate({ target: [guildDictionary.guildId, guildDictionary.from], set: { to } })
    .run();
}

/** @returns 削除された場合 true */
export function deleteDictEntry(guildId: string, from: string): boolean {
  const result = db
    .delete(guildDictionary)
    .where(and(eq(guildDictionary.guildId, guildId), eq(guildDictionary.from, from)))
    .run();
  return result.changes > 0;
}

export function getGuildMessageFilters(guildId: string): { title: string; pattern: string }[] {
  return db
    .select({ title: guildMessageFilters.title, pattern: guildMessageFilters.pattern })
    .from(guildMessageFilters)
    .where(eq(guildMessageFilters.guildId, guildId))
    .orderBy(guildMessageFilters.title)
    .all();
}

export function setMessageFilter(guildId: string, title: string, pattern: string): void {
  db.insert(guildMessageFilters)
    .values({ guildId, title, pattern })
    .onConflictDoUpdate({
      target: [guildMessageFilters.guildId, guildMessageFilters.title],
      set: { pattern },
    })
    .run();
}

/** @returns 削除された場合 true */
export function deleteMessageFilter(guildId: string, title: string): boolean {
  const result = db
    .delete(guildMessageFilters)
    .where(and(eq(guildMessageFilters.guildId, guildId), eq(guildMessageFilters.title, title)))
    .run();
  return result.changes > 0;
}

export function addMessageFilterHit(guildId: string, title: string, userId: string, messageLink: string): void {
  db.insert(guildMessageFilterHits).values({ guildId, title, userId, messageLink }).run();
}

export function getMessageFilterRanking(guildId: string, title: string): { userId: string; count: number }[] {
  return db
    .select({ userId: guildMessageFilterHits.userId, count: count() })
    .from(guildMessageFilterHits)
    .where(
      and(
        eq(guildMessageFilterHits.guildId, guildId),
        eq(guildMessageFilterHits.title, title)
      )
    )
    .groupBy(guildMessageFilterHits.userId)
    .orderBy(desc(count()))
    .all();
}

/** ギルドデフォルト → 1 の順に解決（システムメッセージ用） */
export function resolveGuildSpeakerId(guildId: string): number {
  const guildRow = db.select().from(guildSpeakers).where(eq(guildSpeakers.guildId, guildId)).get();
  return guildRow?.speakerId ?? 1;
}
