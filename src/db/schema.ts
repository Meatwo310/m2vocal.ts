import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const userSpeakers = sqliteTable("user_speakers", {
  userId: text("user_id").primaryKey(),
  speakerId: integer("speaker_id").notNull(),
});

export const guildSpeakers = sqliteTable("guild_speakers", {
  guildId: text("guild_id").primaryKey(),
  speakerId: integer("speaker_id").notNull(),
});

export const guildDictionary = sqliteTable(
  "guild_dictionary",
  {
    guildId: text("guild_id").notNull(),
    from: text("from").notNull(),
    to: text("to").notNull(),
  },
  (t) => [primaryKey({ columns: [t.guildId, t.from] })]
);

export const guildMessageFilters = sqliteTable(
  "guild_message_filters",
  {
    guildId: text("guild_id").notNull(),
    title: text("title").notNull(),
    pattern: text("pattern").notNull(),
  },
  (t) => [primaryKey({ columns: [t.guildId, t.title] })]
);

export const guildMessageFilterHits = sqliteTable("guild_message_filter_hits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  guildId: text("guild_id").notNull(),
  title: text("title").notNull(),
  userId: text("user_id").notNull(),
  messageLink: text("message_link").notNull(),
});
