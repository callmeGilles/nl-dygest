import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../db/schema";
import { extractReadableContent, buildSummarizationPrompt } from "../lib/summarize";
import { parseGmailMessage } from "../lib/newsletters";

describe("End-to-end smoke test", () => {
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle<typeof schema>>;

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

  it("should complete a gazette generation flow (DB only)", async () => {
    // 1. Insert newsletters
    const [nl1] = await db.insert(schema.newsletters).values({
      gmailId: "smoke_001",
      sender: "Lenny <lenny@substack.com>",
      subject: "Why onboarding matters",
      snippet: "The first 5 minutes determine everything...",
      receivedAt: new Date().toISOString(),
      rawHtml: "<h1>Onboarding</h1><p>Content here</p>",
    }).returning();

    // 2. Create edition (gazette)
    const [edition] = await db.insert(schema.editions).values({
      generatedAt: new Date().toISOString(),
    }).returning();

    // 3. Add article (simulating Gemini summarization)
    await db.insert(schema.editionArticles).values({
      editionId: edition.id,
      newsletterId: nl1.id,
      category: "Product",
      headline: "Onboarding Determines Everything",
      summary: "The first 5 minutes of user experience determine retention.",
      keyPoints: JSON.stringify(["First impression matters", "Reduce time to value", "Guide, don't overwhelm"]),
      readingTime: 6,
    });

    // 4. Verify
    const articles = await db.query.editionArticles.findMany();
    expect(articles).toHaveLength(1);
    expect(articles[0].category).toBe("Product");
  });

  it("should parse Gmail messages correctly", () => {
    const msg = {
      id: "test_msg",
      payload: {
        headers: [
          { name: "From", value: "test@example.com" },
          { name: "Subject", value: "Test NL" },
          { name: "Date", value: "Mon, 17 Feb 2026 08:00:00 +0000" },
        ],
        body: { data: "" },
        parts: [{
          mimeType: "text/html",
          body: { data: Buffer.from("<p>Hello</p>").toString("base64url") },
        }],
      },
      snippet: "Hello",
    };
    const parsed = parseGmailMessage(msg);
    expect(parsed.subject).toBe("Test NL");
    expect(parsed.rawHtml).toContain("<p>Hello</p>");
  });

  it("should extract readable content from HTML", () => {
    const html = "<html><body><h1>Title</h1><p>Body text here.</p></body></html>";
    const content = extractReadableContent(html);
    expect(content).toContain("Title");
    expect(content).toContain("Body text");
  });
});
