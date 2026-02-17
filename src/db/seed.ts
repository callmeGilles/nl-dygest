import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";

async function seed() {
  const DB_PATH = process.env.DATABASE_URL || path.join(process.cwd(), "nl-dygest.db");
  const sqlite = new Database(DB_PATH);
  const db = drizzle(sqlite, { schema });

  // Insert fake newsletters
  const newsletters = await db
    .insert(schema.newsletters)
    .values([
      {
        gmailId: "fake_001",
        sender: "Lenny Rachitsky <lenny@substack.com>",
        subject: "Why onboarding is broken (and how to fix it)",
        snippet: "The first 5 minutes of your product experience determine whether users stay or leave...",
        receivedAt: new Date("2026-02-17T08:00:00Z").toISOString(),
        rawHtml: "<h1>Why onboarding is broken</h1><p>The first 5 minutes determine everything.</p>",
      },
      {
        gmailId: "fake_002",
        sender: "TLDR <dan@tldrnewsletter.com>",
        subject: "TLDR Daily - AI Agents Are Taking Over CI/CD",
        snippet: "AI agents are now writing and deploying code autonomously at several startups...",
        receivedAt: new Date("2026-02-17T07:30:00Z").toISOString(),
        rawHtml: "<h1>TLDR Daily</h1><p>AI agents are transforming CI/CD pipelines.</p>",
      },
      {
        gmailId: "fake_003",
        sender: "Benedict Evans <benedict@ben-evans.com>",
        subject: "The great satisficing: why good enough wins",
        snippet: "Most tech products don't need to be perfect. They need to be good enough at the right time...",
        receivedAt: new Date("2026-02-16T18:00:00Z").toISOString(),
        rawHtml: "<h1>The great satisficing</h1><p>Good enough wins in most markets.</p>",
      },
      {
        gmailId: "fake_004",
        sender: "Dense Discovery <kai@densediscovery.com>",
        subject: "Dense Discovery #327 - The joy of quiet software",
        snippet: "This week: calm technology, sustainable design patterns, and a beautiful portfolio...",
        receivedAt: new Date("2026-02-16T10:00:00Z").toISOString(),
        rawHtml: "<h1>Dense Discovery</h1><p>Calm technology and sustainable design patterns.</p>",
      },
      {
        gmailId: "fake_005",
        sender: "Morning Brew <crew@morningbrew.com>",
        subject: "Apple's new AI chip leaves Nvidia scrambling",
        snippet: "Apple unveiled its M5 Ultra chip yesterday, and the benchmarks are staggering...",
        receivedAt: new Date("2026-02-15T11:00:00Z").toISOString(),
        rawHtml: "<h1>Morning Brew</h1><p>Apple's M5 Ultra chip shakes up the AI hardware market.</p>",
      },
    ])
    .returning();

  console.log(`Inserted ${newsletters.length} newsletters`);

  // Triage: keep 3, skip 2
  await db.insert(schema.triageDecisions).values([
    { newsletterId: newsletters[0].id, decision: "kept", triagedAt: new Date().toISOString() },
    { newsletterId: newsletters[1].id, decision: "kept", triagedAt: new Date().toISOString() },
    { newsletterId: newsletters[2].id, decision: "kept", triagedAt: new Date().toISOString() },
    { newsletterId: newsletters[3].id, decision: "skipped", triagedAt: new Date().toISOString() },
    { newsletterId: newsletters[4].id, decision: "skipped", triagedAt: new Date().toISOString() },
  ]);

  console.log("Triage decisions recorded");

  // Create an edition with articles (simulating LLM output)
  const [edition] = await db
    .insert(schema.editions)
    .values({ generatedAt: new Date().toISOString() })
    .returning();

  await db.insert(schema.editionArticles).values([
    {
      editionId: edition.id,
      newsletterId: newsletters[0].id,
      category: "Product",
      headline: "Onboarding Determines Everything",
      summary:
        "Lenny argues that the first 5 minutes of product experience are make-or-break. Companies that invest in onboarding see 2-3x better retention.",
      keyPoints: JSON.stringify([
        "First 5 minutes determine user retention",
        "Progressive disclosure beats feature tours",
        "Measure time-to-value, not sign-ups",
      ]),
      readingTime: 6,
    },
    {
      editionId: edition.id,
      newsletterId: newsletters[1].id,
      category: "Tech",
      headline: "AI Agents Transform CI/CD Pipelines",
      summary:
        "Several startups now deploy AI agents that write tests, review PRs, and handle deployments autonomously. The shift from tools to agents is accelerating.",
      keyPoints: JSON.stringify([
        "AI agents handle full deploy cycles at 3 startups",
        "Code review accuracy rivals senior engineers",
        "Human oversight still required for production releases",
        "Cost reduction of 40-60% on DevOps teams",
      ]),
      readingTime: 4,
    },
    {
      editionId: edition.id,
      newsletterId: newsletters[2].id,
      category: "Business",
      headline: "Why Good Enough Beats Perfect",
      summary:
        "Benedict Evans makes the case that satisficing — choosing the first option that meets your needs — explains most tech market dynamics better than optimization theory.",
      keyPoints: JSON.stringify([
        "Satisficing explains market dynamics better than optimization",
        "Switching costs keep 'good enough' products dominant",
        "Perfection is a luxury most users don't need",
      ]),
      readingTime: 8,
    },
  ]);

  console.log(`Edition #${edition.id} created with 3 articles`);

  // Add a reading session
  await db.insert(schema.readingSessions).values({
    date: "2026-02-17",
    newslettersRead: 3,
    timeSpent: 8,
  });

  console.log("Reading session added");
  console.log("\nSeed complete! Visit http://localhost:3000/read/" + edition.id);

  sqlite.close();
}

seed().catch(console.error);
