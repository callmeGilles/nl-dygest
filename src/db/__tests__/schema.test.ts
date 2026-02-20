import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../schema";

describe("Database schema", () => {
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle>;

  beforeEach(() => {
    sqlite = new Database(":memory:");
    db = drizzle(sqlite, { schema });
    sqlite.exec(`
      CREATE TABLE newsletters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        gmail_id TEXT NOT NULL UNIQUE,
        sender TEXT NOT NULL,
        subject TEXT NOT NULL,
        snippet TEXT NOT NULL,
        received_at TEXT NOT NULL,
        raw_html TEXT NOT NULL
      );
      CREATE TABLE triage_decisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        newsletter_id INTEGER NOT NULL REFERENCES newsletters(id),
        decision TEXT NOT NULL,
        triaged_at TEXT NOT NULL
      );
      CREATE TABLE editions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        generated_at TEXT NOT NULL
      );
      CREATE TABLE edition_articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        edition_id INTEGER NOT NULL REFERENCES editions(id),
        newsletter_id INTEGER NOT NULL REFERENCES newsletters(id),
        category TEXT NOT NULL,
        headline TEXT NOT NULL,
        summary TEXT NOT NULL,
        key_points TEXT NOT NULL,
        reading_time INTEGER NOT NULL,
        section TEXT,
        position INTEGER,
        expanded_summary TEXT
      );
      CREATE TABLE reading_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        newsletters_read INTEGER NOT NULL,
        time_spent INTEGER NOT NULL
      );
    `);
  });

  afterEach(() => {
    sqlite.close();
  });

  it("should insert and retrieve a newsletter", async () => {
    const result = await db.insert(schema.newsletters).values({
      gmailId: "msg_123",
      sender: "test@example.com",
      subject: "Test Newsletter",
      snippet: "A preview of the newsletter",
      receivedAt: new Date().toISOString(),
      rawHtml: "<p>Hello</p>",
    }).returning();

    expect(result[0].gmailId).toBe("msg_123");
    expect(result[0].sender).toBe("test@example.com");
  });

  it("should insert a triage decision", async () => {
    const [newsletter] = await db.insert(schema.newsletters).values({
      gmailId: "msg_456",
      sender: "sender@test.com",
      subject: "Another NL",
      snippet: "Preview",
      receivedAt: new Date().toISOString(),
      rawHtml: "<p>Content</p>",
    }).returning();

    const [decision] = await db.insert(schema.triageDecisions).values({
      newsletterId: newsletter.id,
      decision: "kept",
      triagedAt: new Date().toISOString(),
    }).returning();

    expect(decision.decision).toBe("kept");
    expect(decision.newsletterId).toBe(newsletter.id);
  });

  it("should insert an edition with articles", async () => {
    const [newsletter] = await db.insert(schema.newsletters).values({
      gmailId: "msg_789",
      sender: "nl@test.com",
      subject: "Tech Digest",
      snippet: "Preview",
      receivedAt: new Date().toISOString(),
      rawHtml: "<p>Content</p>",
    }).returning();

    const [edition] = await db.insert(schema.editions).values({
      generatedAt: new Date().toISOString(),
    }).returning();

    const [article] = await db.insert(schema.editionArticles).values({
      editionId: edition.id,
      newsletterId: newsletter.id,
      category: "Tech",
      headline: "New Framework Released",
      summary: "A new JS framework was released today.",
      keyPoints: JSON.stringify(["Fast", "Simple", "Modern"]),
      readingTime: 5,
    }).returning();

    expect(article.category).toBe("Tech");
    expect(article.editionId).toBe(edition.id);
  });

  it("exports userInterests table with expected columns", () => {
    expect(schema.userInterests).toBeDefined();
    const columns = Object.keys(schema.userInterests);
    expect(columns).toContain("id");
    expect(columns).toContain("sessionId");
    expect(columns).toContain("topic");
    expect(columns).toContain("createdAt");
  });

  it("has section, position, and expandedSummary columns on editionArticles", () => {
    const columns = Object.keys(schema.editionArticles);
    expect(columns).toContain("section");
    expect(columns).toContain("position");
    expect(columns).toContain("expandedSummary");
  });

  it("should insert a reading session", async () => {
    const [session] = await db.insert(schema.readingSessions).values({
      date: "2026-02-17",
      newslettersRead: 5,
      timeSpent: 12,
    }).returning();

    expect(session.newslettersRead).toBe(5);
  });
});
