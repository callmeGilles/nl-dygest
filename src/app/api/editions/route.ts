import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { summarizeNewsletter } from "@/lib/summarize";

export async function POST() {
  try {
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

    // Summarize each newsletter (with delay to respect rate limits)
    for (let i = 0; i < toProcess.length; i++) {
      const decision = toProcess[i];
      const newsletter = await db.query.newsletters.findFirst({
        where: eq(schema.newsletters.id, decision.newsletterId),
      });

      if (!newsletter) continue;

      // Wait 5s between calls to stay within free tier rate limits
      if (i > 0) await new Promise((r) => setTimeout(r, 5000));

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
  } catch (error) {
    console.error("Edition generation failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const editions = await db.query.editions.findMany({
    orderBy: (editions, { desc }) => [desc(editions.generatedAt)],
  });
  return NextResponse.json(editions);
}
