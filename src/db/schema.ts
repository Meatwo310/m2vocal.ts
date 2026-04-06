import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const userSpeakers = sqliteTable("user_speakers", {
  userId: text("user_id").primaryKey(),
  speakerId: integer("speaker_id").notNull(),
});

export const guildSpeakers = sqliteTable("guild_speakers", {
  guildId: text("guild_id").primaryKey(),
  speakerId: integer("speaker_id").notNull(),
});
