# briefflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a newsletter triage + interactive newspaper web app that connects to Gmail, lets the user swipe-select newsletters, then generates an LLM-summarized newspaper edition.

**Architecture:** Single Next.js app (App Router) with API routes as backend. SQLite via Drizzle ORM for persistence. Gmail API for email access. Claude API for summarization. mozilla/readability for content extraction.

**Tech Stack:** Next.js 15, TypeScript, Drizzle ORM, better-sqlite3, googleapis, @anthropic-ai/sdk, @mozilla/readability, Tailwind CSS, Vitest

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `.env.example`, `.gitignore`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`

**Step 1: Initialize Next.js project**

Run:
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Expected: Project scaffolded with App Router structure.

**Step 2: Install core dependencies**

Run:
```bash
npm install drizzle-orm better-sqlite3 googleapis @anthropic-ai/sdk @mozilla/readability jsdom
npm install -D drizzle-kit @types/better-sqlite3 @types/jsdom vitest @vitejs/plugin-react
```

**Step 3: Create .env.example**

Create `.env.example`:
```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback
ANTHROPIC_API_KEY=
GMAIL_LABEL=Newsletters
```

**Step 4: Create vitest config**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

**Step 5: Add test script to package.json**

Add to `scripts` in `package.json`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 6: Update .gitignore**

Append to `.gitignore`:
```
*.db
.env
```

**Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js project with dependencies"
```

---

### Task 2: Database Schema (Drizzle + SQLite)

**Files:**
- Create: `src/db/schema.ts`
- Create: `src/db/index.ts`
- Create: `drizzle.config.ts`
- Test: `src/db/__tests__/schema.test.ts`

**Step 1: Write the failing test**

Create `src/db/__tests__/schema.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "../schema";

describe("Database schema", () => {
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle>;

  beforeEach(() => {
    sqlite = new Database(":memory:");
    db = drizzle(sqlite, { schema });
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

  it("should insert a reading session", async () => {
    const [session] = await db.insert(schema.readingSessions).values({
      date: "2026-02-17",
      newslettersRead: 5,
      timeSpent: 12,
    }).returning();

    expect(session.newslettersRead).toBe(5);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/db/__tests__/schema.test.ts`
Expected: FAIL — modules not found.

**Step 3: Write the schema**

Create `src/db/schema.ts`:
```typescript
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

export const readingSessions = sqliteTable("reading_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  newslettersRead: integer("newsletters_read").notNull(),
  timeSpent: integer("time_spent").notNull(),
});
```

**Step 4: Write the database connection module**

Create `src/db/index.ts`:
```typescript
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";

const DB_PATH = process.env.DATABASE_URL || path.join(process.cwd(), "briefflow.db");

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });
export { schema };
```

**Step 5: Create Drizzle config**

Create `drizzle.config.ts`:
```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: "./briefflow.db",
  },
});
```

**Step 6: Generate migrations and update test to use them**

Run: `npx drizzle-kit generate`

Then update the test `beforeEach` to push schema directly:
```typescript
beforeEach(() => {
  sqlite = new Database(":memory:");
  db = drizzle(sqlite, { schema });
  // Push schema tables directly for testing
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
      reading_time INTEGER NOT NULL
    );
    CREATE TABLE reading_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      newsletters_read INTEGER NOT NULL,
      time_spent INTEGER NOT NULL
    );
  `);
});
```

**Step 7: Run tests to verify they pass**

Run: `npx vitest run src/db/__tests__/schema.test.ts`
Expected: 4 tests PASS.

**Step 8: Commit**

```bash
git add src/db/ drizzle.config.ts drizzle/
git commit -m "feat: add database schema with Drizzle ORM"
```

---

### Task 3: Gmail OAuth Flow

**Files:**
- Create: `src/lib/gmail.ts`
- Create: `src/app/api/auth/route.ts`
- Create: `src/app/api/auth/callback/route.ts`
- Test: `src/lib/__tests__/gmail.test.ts`

**Step 1: Write the failing test**

Create `src/lib/__tests__/gmail.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { getAuthUrl, getTokensFromCode } from "../gmail";

describe("Gmail OAuth", () => {
  it("should generate an auth URL with correct scopes", () => {
    const url = getAuthUrl();
    expect(url).toContain("accounts.google.com");
    expect(url).toContain("gmail.modify");
    expect(url).toContain("redirect_uri");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/gmail.test.ts`
Expected: FAIL — module not found.

**Step 3: Implement Gmail auth helpers**

Create `src/lib/gmail.ts`:
```typescript
import { google } from "googleapis";
import fs from "fs";
import path from "path";

const TOKEN_PATH = path.join(process.cwd(), ".gmail-tokens.json");

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/callback"
  );
}

export function getAuthUrl(): string {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/gmail.modify"],
    prompt: "consent",
  });
}

export async function getTokensFromCode(code: string) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
  return tokens;
}

export function getAuthedClient() {
  const oauth2Client = getOAuth2Client();
  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
  oauth2Client.setCredentials(tokens);
  return oauth2Client;
}

export function isAuthenticated(): boolean {
  return fs.existsSync(TOKEN_PATH);
}

export function getGmailClient() {
  const auth = getAuthedClient();
  return google.gmail({ version: "v1", auth });
}
```

**Step 4: Implement auth API routes**

Create `src/app/api/auth/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/gmail";

export async function GET() {
  const url = getAuthUrl();
  return NextResponse.redirect(url);
}
```

Create `src/app/api/auth/callback/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { getTokensFromCode } from "@/lib/gmail";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "No code provided" }, { status: 400 });
  }
  await getTokensFromCode(code);
  return NextResponse.redirect(new URL("/triage", request.url));
}
```

**Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/gmail.test.ts`
Expected: PASS.

**Step 6: Add token file to .gitignore**

Append `.gmail-tokens.json` to `.gitignore`.

**Step 7: Commit**

```bash
git add src/lib/gmail.ts src/app/api/auth/ .gitignore
git commit -m "feat: add Gmail OAuth flow"
```

---

### Task 4: Newsletter Fetching from Gmail

**Files:**
- Create: `src/lib/newsletters.ts`
- Test: `src/lib/__tests__/newsletters.test.ts`

**Step 1: Write the failing test**

Create `src/lib/__tests__/newsletters.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { parseGmailMessage } from "../newsletters";

describe("parseGmailMessage", () => {
  it("should extract sender, subject, snippet from Gmail message", () => {
    const gmailMessage = {
      id: "msg_001",
      payload: {
        headers: [
          { name: "From", value: "Lenny <lenny@substack.com>" },
          { name: "Subject", value: "Why onboarding is broken" },
          { name: "Date", value: "Mon, 10 Feb 2026 08:00:00 +0000" },
        ],
        body: { data: "" },
        parts: [
          {
            mimeType: "text/html",
            body: {
              data: Buffer.from("<p>Hello world</p>").toString("base64url"),
            },
          },
        ],
      },
      snippet: "Hello world preview text",
    };

    const result = parseGmailMessage(gmailMessage);

    expect(result.gmailId).toBe("msg_001");
    expect(result.sender).toBe("Lenny <lenny@substack.com>");
    expect(result.subject).toBe("Why onboarding is broken");
    expect(result.snippet).toBe("Hello world preview text");
    expect(result.rawHtml).toContain("<p>Hello world</p>");
  });

  it("should handle messages with nested parts", () => {
    const gmailMessage = {
      id: "msg_002",
      payload: {
        headers: [
          { name: "From", value: "sender@test.com" },
          { name: "Subject", value: "Test" },
          { name: "Date", value: "Tue, 11 Feb 2026 10:00:00 +0000" },
        ],
        body: { data: "" },
        parts: [
          {
            mimeType: "multipart/alternative",
            parts: [
              {
                mimeType: "text/html",
                body: {
                  data: Buffer.from("<h1>Nested</h1>").toString("base64url"),
                },
              },
            ],
          },
        ],
      },
      snippet: "Nested preview",
    };

    const result = parseGmailMessage(gmailMessage);
    expect(result.rawHtml).toContain("<h1>Nested</h1>");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/newsletters.test.ts`
Expected: FAIL — module not found.

**Step 3: Implement newsletter parsing and fetching**

Create `src/lib/newsletters.ts`:
```typescript
import { getGmailClient } from "./gmail";

interface ParsedNewsletter {
  gmailId: string;
  sender: string;
  subject: string;
  snippet: string;
  receivedAt: string;
  rawHtml: string;
}

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

function extractHtmlBody(payload: any): string {
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf-8");
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const html = extractHtmlBody(part);
      if (html) return html;
    }
  }
  return "";
}

export function parseGmailMessage(message: any): ParsedNewsletter {
  const headers = message.payload.headers || [];
  const dateStr = getHeader(headers, "Date");

  return {
    gmailId: message.id,
    sender: getHeader(headers, "From"),
    subject: getHeader(headers, "Subject"),
    snippet: message.snippet || "",
    receivedAt: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
    rawHtml: extractHtmlBody(message.payload),
  };
}

export async function fetchNewsletters(label: string, maxResults = 20): Promise<ParsedNewsletter[]> {
  const gmail = getGmailClient();

  // Find label ID
  const labels = await gmail.users.labels.list({ userId: "me" });
  const targetLabel = labels.data.labels?.find(
    (l) => l.name?.toLowerCase() === label.toLowerCase()
  );

  if (!targetLabel?.id) {
    throw new Error(`Label "${label}" not found in Gmail`);
  }

  // Fetch message IDs
  const response = await gmail.users.messages.list({
    userId: "me",
    labelIds: [targetLabel.id],
    q: "is:unread",
    maxResults,
  });

  if (!response.data.messages?.length) {
    return [];
  }

  // Fetch full messages
  const messages = await Promise.all(
    response.data.messages.map((msg) =>
      gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "full",
      })
    )
  );

  return messages.map((m) => parseGmailMessage(m.data));
}

export async function markAsRead(gmailId: string) {
  const gmail = getGmailClient();
  await gmail.users.messages.modify({
    userId: "me",
    id: gmailId,
    requestBody: { removeLabelIds: ["UNREAD"] },
  });
}

export async function addLabel(gmailId: string, labelName: string) {
  const gmail = getGmailClient();

  // Ensure label exists, create if not
  const labels = await gmail.users.labels.list({ userId: "me" });
  let label = labels.data.labels?.find((l) => l.name === labelName);

  if (!label) {
    const created = await gmail.users.labels.create({
      userId: "me",
      requestBody: { name: labelName },
    });
    label = created.data;
  }

  await gmail.users.messages.modify({
    userId: "me",
    id: gmailId,
    requestBody: { addLabelIds: [label.id!] },
  });
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/newsletters.test.ts`
Expected: 2 tests PASS.

**Step 5: Commit**

```bash
git add src/lib/newsletters.ts src/lib/__tests__/newsletters.test.ts
git commit -m "feat: add Gmail newsletter fetching and parsing"
```

---

### Task 5: LLM Summarization Pipeline

**Files:**
- Create: `src/lib/summarize.ts`
- Test: `src/lib/__tests__/summarize.test.ts`

**Step 1: Write the failing test**

Create `src/lib/__tests__/summarize.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { extractReadableContent, buildSummarizationPrompt } from "../summarize";

describe("extractReadableContent", () => {
  it("should extract text from HTML", () => {
    const html = `
      <html><body>
        <h1>Weekly Tech Digest</h1>
        <p>Here are the top stories this week.</p>
        <ul><li>Story one</li><li>Story two</li></ul>
      </body></html>
    `;
    const result = extractReadableContent(html);
    expect(result).toContain("Weekly Tech Digest");
    expect(result).toContain("top stories");
  });
});

describe("buildSummarizationPrompt", () => {
  it("should return a prompt with the newsletter content", () => {
    const content = "This is a newsletter about TypeScript features.";
    const prompt = buildSummarizationPrompt(content);
    expect(prompt).toContain("TypeScript features");
    expect(prompt).toContain("category");
    expect(prompt).toContain("headline");
    expect(prompt).toContain("summary");
    expect(prompt).toContain("key_points");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/summarize.test.ts`
Expected: FAIL — module not found.

**Step 3: Implement summarization module**

Create `src/lib/summarize.ts`:
```typescript
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import Anthropic from "@anthropic-ai/sdk";

export function extractReadableContent(html: string): string {
  const dom = new JSDOM(html, { url: "https://example.com" });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  return article?.textContent || dom.window.document.body?.textContent || "";
}

export function buildSummarizationPrompt(content: string): string {
  return `Analyze this newsletter and return a JSON object with these fields:
- "category": one of "Tech", "Product", "Business", "Design", "Other"
- "headline": a concise headline, max 10 words
- "summary": 2-3 sentence summary
- "key_points": array of 3-5 bullet point strings
- "reading_time": estimated minutes to read the full original

Return ONLY valid JSON, no markdown fences.

Newsletter content:
${content.slice(0, 8000)}`;
}

export interface ArticleSummary {
  category: string;
  headline: string;
  summary: string;
  key_points: string[];
  reading_time: number;
}

export async function summarizeNewsletter(html: string): Promise<ArticleSummary> {
  const content = extractReadableContent(html);
  const prompt = buildSummarizationPrompt(content);

  const client = new Anthropic();
  const message = await client.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  return JSON.parse(text) as ArticleSummary;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/summarize.test.ts`
Expected: 2 tests PASS.

**Step 5: Commit**

```bash
git add src/lib/summarize.ts src/lib/__tests__/summarize.test.ts
git commit -m "feat: add newsletter summarization with Readability + Claude"
```

---

### Task 6: Newsletter API Routes

**Files:**
- Create: `src/app/api/newsletters/route.ts`
- Create: `src/app/api/newsletters/triage/route.ts`
- Create: `src/app/api/editions/route.ts`
- Create: `src/app/api/editions/[id]/route.ts`

**Step 1: Implement newsletters API**

Create `src/app/api/newsletters/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { fetchNewsletters } from "@/lib/newsletters";
import { isAuthenticated } from "@/lib/gmail";
import { eq, isNull, notInArray } from "drizzle-orm";

export async function GET() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const label = process.env.GMAIL_LABEL || "Newsletters";

  // Fetch from Gmail
  const gmailNewsletters = await fetchNewsletters(label);

  // Upsert into DB
  for (const nl of gmailNewsletters) {
    const existing = await db.query.newsletters.findFirst({
      where: eq(schema.newsletters.gmailId, nl.gmailId),
    });
    if (!existing) {
      await db.insert(schema.newsletters).values(nl);
    }
  }

  // Return untriaged newsletters
  const triaged = db
    .select({ newsletterId: schema.triageDecisions.newsletterId })
    .from(schema.triageDecisions);

  const untriaged = await db.query.newsletters.findMany({
    where: notInArray(schema.newsletters.id, triaged),
    orderBy: (newsletters, { desc }) => [desc(newsletters.receivedAt)],
  });

  return NextResponse.json(untriaged);
}
```

**Step 2: Implement triage API**

Create `src/app/api/newsletters/triage/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { markAsRead, addLabel } from "@/lib/newsletters";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const { newsletterId, decision } = await request.json();

  if (!newsletterId || !["kept", "skipped"].includes(decision)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Save decision
  await db.insert(schema.triageDecisions).values({
    newsletterId,
    decision,
    triagedAt: new Date().toISOString(),
  });

  // Sync with Gmail
  const newsletter = await db.query.newsletters.findFirst({
    where: eq(schema.newsletters.id, newsletterId),
  });

  if (newsletter) {
    if (decision === "skipped") {
      await markAsRead(newsletter.gmailId);
    } else {
      await addLabel(newsletter.gmailId, "briefflow/kept");
    }
  }

  return NextResponse.json({ success: true });
}
```

**Step 3: Implement editions API**

Create `src/app/api/editions/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { summarizeNewsletter } from "@/lib/summarize";

export async function POST() {
  // Get all "kept" newsletters not yet in any edition
  const keptDecisions = await db.query.triageDecisions.findMany({
    where: eq(schema.triageDecisions.decision, "kept"),
  });

  const existingArticles = await db.query.editionArticles.findMany();
  const processedNlIds = new Set(existingArticles.map((a) => a.newsletterId));

  const toProcess = keptDecisions.filter(
    (d) => !processedNlIds.has(d.newsletterId)
  );

  if (toProcess.length === 0) {
    return NextResponse.json({ error: "No new newsletters to process" }, { status: 400 });
  }

  // Create edition
  const [edition] = await db
    .insert(schema.editions)
    .values({ generatedAt: new Date().toISOString() })
    .returning();

  // Summarize each newsletter
  for (const decision of toProcess) {
    const newsletter = await db.query.newsletters.findFirst({
      where: eq(schema.newsletters.id, decision.newsletterId),
    });

    if (!newsletter) continue;

    const summary = await summarizeNewsletter(newsletter.rawHtml);

    await db.insert(schema.editionArticles).values({
      editionId: edition.id,
      newsletterId: newsletter.id,
      category: summary.category,
      headline: summary.headline,
      summary: summary.summary,
      keyPoints: JSON.stringify(summary.key_points),
      readingTime: summary.reading_time,
    });
  }

  return NextResponse.json({ editionId: edition.id });
}

export async function GET() {
  const editions = await db.query.editions.findMany({
    orderBy: (editions, { desc }) => [desc(editions.generatedAt)],
  });
  return NextResponse.json(editions);
}
```

Create `src/app/api/editions/[id]/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const editionId = parseInt(id);

  const edition = await db.query.editions.findFirst({
    where: eq(schema.editions.id, editionId),
  });

  if (!edition) {
    return NextResponse.json({ error: "Edition not found" }, { status: 404 });
  }

  const articles = await db.query.editionArticles.findMany({
    where: eq(schema.editionArticles.editionId, editionId),
  });

  // Group articles by category
  const grouped: Record<string, typeof articles> = {};
  for (const article of articles) {
    if (!grouped[article.category]) grouped[article.category] = [];
    grouped[article.category].push(article);
  }

  return NextResponse.json({ edition, articles: grouped });
}
```

**Step 4: Commit**

```bash
git add src/app/api/
git commit -m "feat: add API routes for newsletters, triage, and editions"
```

---

### Task 7: Triage UI (Swipe Cards)

**Files:**
- Create: `src/app/triage/page.tsx`
- Create: `src/components/triage-card.tsx`
- Create: `src/components/progress-bar.tsx`

**Step 1: Build the triage card component**

Create `src/components/triage-card.tsx`:
```tsx
"use client";

import { useState } from "react";

interface Newsletter {
  id: number;
  sender: string;
  subject: string;
  snippet: string;
  receivedAt: string;
}

interface TriageCardProps {
  newsletter: Newsletter;
  onDecision: (decision: "kept" | "skipped") => void;
}

export function TriageCard({ newsletter, onDecision }: TriageCardProps) {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setStartX(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    setDragX(e.touches[0].clientX - startX);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (dragX > 100) {
      onDecision("kept");
    } else if (dragX < -100) {
      onDecision("skipped");
    }
    setDragX(0);
  };

  const date = new Date(newsletter.receivedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <div
      className="relative w-full max-w-sm mx-auto"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: `translateX(${dragX}px) rotate(${dragX * 0.05}deg)`,
        transition: isDragging ? "none" : "transform 0.3s ease",
      }}
    >
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 min-h-[300px] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-500">{newsletter.sender}</span>
          <span className="text-xs text-gray-400">{date}</span>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">{newsletter.subject}</h2>
        <p className="text-sm text-gray-600 flex-grow">{newsletter.snippet}</p>
      </div>

      {/* Swipe indicators */}
      {dragX > 50 && (
        <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold">
          KEEP
        </div>
      )}
      {dragX < -50 && (
        <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">
          SKIP
        </div>
      )}
    </div>
  );
}
```

**Step 2: Build the progress bar**

Create `src/components/progress-bar.tsx`:
```tsx
interface ProgressBarProps {
  current: number;
  total: number;
}

export function ProgressBar({ current, total }: ProgressBarProps) {
  const progress = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="w-full max-w-sm mx-auto mb-6">
      <div className="flex justify-between text-sm text-gray-500 mb-1">
        <span>{current} of {total} newsletters</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
```

**Step 3: Build the triage page**

Create `src/app/triage/page.tsx`:
```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { TriageCard } from "@/components/triage-card";
import { ProgressBar } from "@/components/progress-bar";
import { useRouter } from "next/navigation";

interface Newsletter {
  id: number;
  sender: string;
  subject: string;
  snippet: string;
  receivedAt: string;
}

export default function TriagePage() {
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/newsletters")
      .then((r) => r.json())
      .then((data) => {
        setNewsletters(data);
        setLoading(false);
      });
  }, []);

  const handleDecision = useCallback(
    async (decision: "kept" | "skipped") => {
      const newsletter = newsletters[currentIndex];
      await fetch("/api/newsletters/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newsletterId: newsletter.id, decision }),
      });
      setCurrentIndex((i) => i + 1);
    },
    [newsletters, currentIndex]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (currentIndex >= newsletters.length) return;
      if (e.key === "ArrowRight") handleDecision("kept");
      if (e.key === "ArrowLeft") handleDecision("skipped");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleDecision, currentIndex, newsletters.length]);

  const handleGenerate = async () => {
    const res = await fetch("/api/editions", { method: "POST" });
    const data = await res.json();
    if (data.editionId) {
      router.push(`/read/${data.editionId}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading newsletters...</p>
      </div>
    );
  }

  const isDone = currentIndex >= newsletters.length;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Triage</h1>

      {!isDone ? (
        <>
          <ProgressBar current={currentIndex} total={newsletters.length} />
          <TriageCard
            newsletter={newsletters[currentIndex]}
            onDecision={handleDecision}
          />
          <div className="flex gap-4 mt-6">
            <button
              onClick={() => handleDecision("skipped")}
              className="px-6 py-3 bg-red-100 text-red-700 rounded-full font-medium hover:bg-red-200 transition"
            >
              Skip
            </button>
            <button
              onClick={() => handleDecision("kept")}
              className="px-6 py-3 bg-green-100 text-green-700 rounded-full font-medium hover:bg-green-200 transition"
            >
              Keep
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-4">
            Use arrow keys: ← skip · → keep
          </p>
        </>
      ) : (
        <div className="text-center">
          <p className="text-lg text-gray-600 mb-4">
            All caught up! Ready to generate your edition.
          </p>
          <button
            onClick={handleGenerate}
            className="px-8 py-3 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transition"
          >
            Generate My Edition
          </button>
        </div>
      )}
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add src/app/triage/ src/components/
git commit -m "feat: add triage UI with swipe cards and keyboard shortcuts"
```

---

### Task 8: Newspaper View

**Files:**
- Create: `src/app/read/[id]/page.tsx`
- Create: `src/components/article-card.tsx`
- Create: `src/components/stats-bar.tsx`

**Step 1: Build the article card component**

Create `src/components/article-card.tsx`:
```tsx
"use client";

import { useState } from "react";

interface Article {
  id: number;
  headline: string;
  summary: string;
  keyPoints: string;
  readingTime: number;
  newsletterId: number;
}

export function ArticleCard({ article }: { article: Article }) {
  const [expanded, setExpanded] = useState(false);
  const keyPoints: string[] = JSON.parse(article.keyPoints);

  return (
    <article
      className="border-b border-gray-200 py-4 cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start justify-between">
        <h3 className="text-lg font-semibold text-gray-900 leading-tight">
          {article.headline}
        </h3>
        <span className="text-xs text-gray-400 whitespace-nowrap ml-4">
          {article.readingTime} min
        </span>
      </div>
      <p className="text-sm text-gray-600 mt-1">{article.summary}</p>

      {expanded && (
        <div className="mt-3 pl-4 border-l-2 border-blue-200">
          <p className="text-xs font-medium text-gray-500 uppercase mb-2">Key Points</p>
          <ul className="space-y-1">
            {keyPoints.map((point, i) => (
              <li key={i} className="text-sm text-gray-700">
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
```

**Step 2: Build the stats bar**

Create `src/components/stats-bar.tsx`:
```tsx
interface StatsBarProps {
  streak: number;
  readThisWeek: number;
  remaining: number;
}

export function StatsBar({ streak, readThisWeek, remaining }: StatsBarProps) {
  return (
    <div className="flex items-center gap-6 text-sm text-gray-500 py-3 border-b border-gray-300 mb-6">
      <span>
        <span className="text-orange-500 font-bold">{streak}-day</span> streak
      </span>
      <span>
        <span className="font-bold text-gray-700">{readThisWeek}</span> read this week
      </span>
      <span>
        <span className="font-bold text-gray-700">{remaining.toLocaleString()}</span> remaining
      </span>
    </div>
  );
}
```

**Step 3: Build the newspaper page**

Create `src/app/read/[id]/page.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArticleCard } from "@/components/article-card";
import { StatsBar } from "@/components/stats-bar";

interface Article {
  id: number;
  headline: string;
  summary: string;
  keyPoints: string;
  readingTime: number;
  newsletterId: number;
}

interface EditionData {
  edition: { id: number; generatedAt: string };
  articles: Record<string, Article[]>;
}

const CATEGORY_ICONS: Record<string, string> = {
  Tech: "~",
  Product: "#",
  Business: "$",
  Design: "*",
  Other: "+",
};

export default function NewspaperPage() {
  const params = useParams();
  const [data, setData] = useState<EditionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/editions/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, [params.id]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading your edition...</p>
      </div>
    );
  }

  const date = new Date(data.edition.generatedAt).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const totalArticles = Object.values(data.articles).flat().length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Newspaper header */}
      <header className="text-center border-b-4 border-double border-gray-900 pb-4 mb-2">
        <h1 className="text-4xl font-serif font-bold tracking-tight text-gray-900">
          briefflow
        </h1>
        <p className="text-sm text-gray-500 mt-1">{date}</p>
        <p className="text-xs text-gray-400">
          Edition #{data.edition.id} &middot; {totalArticles} articles
        </p>
      </header>

      <StatsBar streak={1} readThisWeek={totalArticles} remaining={0} />

      {/* Articles by category */}
      {Object.entries(data.articles).map(([category, articles]) => (
        <section key={category} className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 border-b border-gray-200 pb-1 mb-3">
            {CATEGORY_ICONS[category] || "+"} {category}
          </h2>
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </section>
      ))}
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add src/app/read/ src/components/article-card.tsx src/components/stats-bar.tsx
git commit -m "feat: add newspaper view with expandable articles and stats"
```

---

### Task 9: Stats API & Page

**Files:**
- Create: `src/app/api/stats/route.ts`
- Create: `src/app/stats/page.tsx`

**Step 1: Implement stats API**

Create `src/app/api/stats/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { sql, count, eq } from "drizzle-orm";

export async function GET() {
  // Total newsletters in DB
  const [{ total }] = await db
    .select({ total: count() })
    .from(schema.newsletters);

  // Total triaged
  const [{ triaged }] = await db
    .select({ triaged: count() })
    .from(schema.triageDecisions);

  // Total kept
  const [{ kept }] = await db
    .select({ kept: count() })
    .from(schema.triageDecisions)
    .where(eq(schema.triageDecisions.decision, "kept"));

  // Reading sessions (last 7 days)
  const sessions = await db.query.readingSessions.findMany({
    orderBy: (s, { desc }) => [desc(s.date)],
    limit: 30,
  });

  // Calculate streak
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < sessions.length; i++) {
    const sessionDate = new Date(sessions[i].date);
    const expectedDate = new Date(today);
    expectedDate.setDate(expectedDate.getDate() - i);

    if (sessionDate.toDateString() === expectedDate.toDateString()) {
      streak++;
    } else {
      break;
    }
  }

  // Editions count
  const [{ editions }] = await db
    .select({ editions: count() })
    .from(schema.editions);

  return NextResponse.json({
    total,
    triaged,
    kept,
    remaining: total - triaged,
    streak,
    editions,
    recentSessions: sessions.slice(0, 7),
  });
}
```

**Step 2: Build stats page**

Create `src/app/stats/page.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";

interface Stats {
  total: number;
  triaged: number;
  kept: number;
  remaining: number;
  streak: number;
  editions: number;
  recentSessions: Array<{
    date: string;
    newslettersRead: number;
    timeSpent: number;
  }>;
}

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats);
  }, []);

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading stats...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Reading Stats</h1>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <p className="text-3xl font-bold text-orange-500">{stats.streak}</p>
          <p className="text-sm text-gray-500">Day streak</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <p className="text-3xl font-bold text-blue-600">{stats.editions}</p>
          <p className="text-sm text-gray-500">Editions generated</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <p className="text-3xl font-bold text-green-600">{stats.kept}</p>
          <p className="text-sm text-gray-500">Newsletters read</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <p className="text-3xl font-bold text-gray-700">{stats.remaining}</p>
          <p className="text-sm text-gray-500">Remaining</p>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-gray-900 mb-3">Recent Activity</h2>
      {stats.recentSessions.length > 0 ? (
        <div className="space-y-2">
          {stats.recentSessions.map((session) => (
            <div
              key={session.date}
              className="flex items-center justify-between bg-white rounded-lg p-3 shadow-sm border"
            >
              <span className="text-sm text-gray-600">{session.date}</span>
              <span className="text-sm text-gray-500">
                {session.newslettersRead} read &middot; {session.timeSpent} min
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400">No reading sessions yet. Start triaging!</p>
      )}
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/app/api/stats/ src/app/stats/
git commit -m "feat: add stats API and stats page"
```

---

### Task 10: Home Page & Navigation

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/layout.tsx`

**Step 1: Update the home page**

Replace `src/app/page.tsx`:
```tsx
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <h1 className="text-5xl font-serif font-bold text-gray-900 mb-2">briefflow</h1>
      <p className="text-gray-500 mb-8">Your daily newsletter companion</p>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link
          href="/triage"
          className="block text-center px-6 py-3 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transition"
        >
          Start Triage
        </Link>
        <Link
          href="/stats"
          className="block text-center px-6 py-3 bg-gray-200 text-gray-700 rounded-full font-medium hover:bg-gray-300 transition"
        >
          View Stats
        </Link>
        <Link
          href="/api/auth"
          className="block text-center px-6 py-3 border border-gray-300 text-gray-600 rounded-full font-medium hover:bg-gray-100 transition"
        >
          Connect Gmail
        </Link>
      </div>
    </div>
  );
}
```

**Step 2: Add navigation to layout**

Update `src/app/layout.tsx` to include a minimal nav bar in the body:
```tsx
import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "briefflow",
  description: "Your daily newsletter companion",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <nav className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
          <Link href="/" className="font-serif font-bold text-lg text-gray-900">
            briefflow
          </Link>
          <div className="flex gap-4 text-sm">
            <Link href="/triage" className="text-gray-600 hover:text-gray-900">
              Triage
            </Link>
            <Link href="/stats" className="text-gray-600 hover:text-gray-900">
              Stats
            </Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
```

**Step 3: Commit**

```bash
git add src/app/page.tsx src/app/layout.tsx
git commit -m "feat: add home page and navigation"
```

---

### Task 11: Database Migration Script & App Initialization

**Files:**
- Create: `src/db/migrate.ts`
- Modify: `package.json`

**Step 1: Create migration script**

Create `src/db/migrate.ts`:
```typescript
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";

const DB_PATH = process.env.DATABASE_URL || path.join(process.cwd(), "briefflow.db");
const sqlite = new Database(DB_PATH);
const db = drizzle(sqlite);

migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });

console.log("Migrations applied successfully.");
sqlite.close();
```

**Step 2: Add scripts to package.json**

Add to `scripts`:
```json
"db:generate": "drizzle-kit generate",
"db:migrate": "tsx src/db/migrate.ts",
"db:studio": "drizzle-kit studio"
```

**Step 3: Install tsx**

Run: `npm install -D tsx`

**Step 4: Commit**

```bash
git add src/db/migrate.ts package.json
git commit -m "feat: add database migration script"
```

---

### Task 12: End-to-End Smoke Test

**Files:**
- Create: `src/__tests__/smoke.test.ts`

**Step 1: Write the smoke test**

Create `src/__tests__/smoke.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../db/schema";
import { extractReadableContent, buildSummarizationPrompt } from "../lib/summarize";
import { parseGmailMessage } from "../lib/newsletters";

describe("End-to-end smoke test", () => {
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
        reading_time INTEGER NOT NULL
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

  it("should complete a full triage-to-edition flow (DB only)", async () => {
    // 1. Insert newsletters
    const [nl1] = await db.insert(schema.newsletters).values({
      gmailId: "smoke_001",
      sender: "Lenny <lenny@substack.com>",
      subject: "Why onboarding matters",
      snippet: "The first 5 minutes determine everything...",
      receivedAt: new Date().toISOString(),
      rawHtml: "<h1>Onboarding</h1><p>Content here</p>",
    }).returning();

    const [nl2] = await db.insert(schema.newsletters).values({
      gmailId: "smoke_002",
      sender: "TLDR <tldr@newsletter.com>",
      subject: "TLDR Daily - Feb 17",
      snippet: "Top stories in tech today...",
      receivedAt: new Date().toISOString(),
      rawHtml: "<h1>TLDR</h1><p>Stories</p>",
    }).returning();

    // 2. Triage: keep nl1, skip nl2
    await db.insert(schema.triageDecisions).values([
      { newsletterId: nl1.id, decision: "kept", triagedAt: new Date().toISOString() },
      { newsletterId: nl2.id, decision: "skipped", triagedAt: new Date().toISOString() },
    ]);

    // 3. Create edition
    const [edition] = await db.insert(schema.editions).values({
      generatedAt: new Date().toISOString(),
    }).returning();

    // 4. Add article (simulating LLM output)
    await db.insert(schema.editionArticles).values({
      editionId: edition.id,
      newsletterId: nl1.id,
      category: "Product",
      headline: "Onboarding Determines Everything",
      summary: "The first 5 minutes of user experience determine retention.",
      keyPoints: JSON.stringify(["First impression matters", "Reduce time to value", "Guide, don't overwhelm"]),
      readingTime: 6,
    });

    // 5. Verify
    const articles = await db.query.editionArticles.findMany();
    expect(articles).toHaveLength(1);
    expect(articles[0].category).toBe("Product");

    const decisions = await db.query.triageDecisions.findMany();
    expect(decisions).toHaveLength(2);
    expect(decisions.filter((d) => d.decision === "kept")).toHaveLength(1);
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
```

**Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS.

**Step 3: Commit**

```bash
git add src/__tests__/smoke.test.ts
git commit -m "test: add end-to-end smoke test"
```

---

## Task Summary

| # | Task | Effort | Key Output |
|---|------|--------|------------|
| 1 | Project scaffolding | ~5 min | Next.js project with deps |
| 2 | Database schema | ~10 min | Drizzle schema + tests |
| 3 | Gmail OAuth flow | ~10 min | Auth routes + helpers |
| 4 | Newsletter fetching | ~10 min | Gmail parser + fetcher |
| 5 | LLM summarization | ~10 min | Readability + Claude pipeline |
| 6 | API routes | ~15 min | Newsletters, triage, editions APIs |
| 7 | Triage UI | ~15 min | Swipe cards + keyboard shortcuts |
| 8 | Newspaper view | ~15 min | Typography layout + expandable articles |
| 9 | Stats page | ~10 min | Stats API + dashboard |
| 10 | Home + navigation | ~5 min | Landing page + nav bar |
| 11 | Migration script | ~5 min | DB setup automation |
| 12 | Smoke test | ~10 min | End-to-end verification |
