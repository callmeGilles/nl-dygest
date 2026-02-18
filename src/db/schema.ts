import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const newsletters = sqliteTable("newsletters", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gmailId: text("gmail_id").notNull().unique(),
  sender: text("sender").notNull(),
  subject: text("subject").notNull(),
  snippet: text("snippet").notNull(),
  receivedAt: text("received_at").notNull(),
  rawHtml: text("raw_html").notNull(),
});

export const triageDecisions = sqliteTable("triage_decisions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  newsletterId: integer("newsletter_id")
    .notNull()
    .references(() => newsletters.id),
  decision: text("decision", { enum: ["kept", "skipped"] }).notNull(),
  triagedAt: text("triaged_at").notNull(),
});

export const editions = sqliteTable("editions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  generatedAt: text("generated_at").notNull(),
});

export const editionArticles = sqliteTable("edition_articles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  editionId: integer("edition_id")
    .notNull()
    .references(() => editions.id),
  newsletterId: integer("newsletter_id")
    .notNull()
    .references(() => newsletters.id),
  category: text("category").notNull(),
  headline: text("headline").notNull(),
  summary: text("summary").notNull(),
  keyPoints: text("key_points").notNull(),
  readingTime: integer("reading_time").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  token: text("token").notNull().unique(),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
});

export const userTokens = sqliteTable("user_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id")
    .notNull()
    .references(() => sessions.id),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: text("expires_at"),
});

export const userPreferences = sqliteTable("user_preferences", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id")
    .notNull()
    .references(() => sessions.id),
  gmailLabel: text("gmail_label").default("Newsletters"),
  onboardingCompleted: integer("onboarding_completed").default(0),
});

export const readingSessions = sqliteTable("reading_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  newslettersRead: integer("newsletters_read").notNull(),
  timeSpent: integer("time_spent").notNull(),
});
