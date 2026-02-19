import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { getAuthenticatedSession } from "@/lib/auth-helpers";
import { fetchNewsletters, selectRandomNewsletters } from "@/lib/newsletters";

export async function POST() {
  try {
    const auth = await getAuthenticatedSession();
    if (!auth?.tokens) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Check if gazette already exists for today
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const existingEditions = await db.query.editions.findMany({
      orderBy: (editions, { desc }) => [desc(editions.generatedAt)],
    });
    const todayEdition = existingEditions.find(
      (e) => e.generatedAt.split("T")[0] === today
    );

    if (todayEdition) {
      return NextResponse.json({
        editionId: todayEdition.id,
        status: "ready",
      });
    }

    // Fetch unread newsletters from Gmail
    const label = auth.preferences?.gmailLabel || "Newsletters";
    const gmailNewsletters = await fetchNewsletters(
      label,
      50, // fetch more to have a good pool
      auth.tokens.accessToken,
      auth.tokens.refreshToken
    );

    // Store new newsletters in DB
    for (const nl of gmailNewsletters) {
      const existing = await db.query.newsletters.findFirst({
        where: (newsletters, { eq }) => eq(newsletters.gmailId, nl.gmailId),
      });
      if (!existing) {
        await db.insert(schema.newsletters).values(nl);
      }
    }

    // Get all newsletters not yet in any edition
    const existingArticles = await db.query.editionArticles.findMany();
    const processedNlIds = new Set(existingArticles.map((a) => a.newsletterId));

    const allNewsletters = await db.query.newsletters.findMany();
    const available = allNewsletters.filter((nl) => !processedNlIds.has(nl.id));

    if (available.length === 0) {
      return NextResponse.json(
        { error: "No unread newsletters available" },
        { status: 400 }
      );
    }

    // Pick 5-10 random newsletters
    const selected = selectRandomNewsletters(available, 5, 10);

    // Create edition
    const [edition] = await db
      .insert(schema.editions)
      .values({ generatedAt: new Date().toISOString() })
      .returning();

    return NextResponse.json({
      editionId: edition.id,
      status: "generating",
      total: selected.length,
      newsletterIds: selected.map((nl) => nl.id),
    });
  } catch (error) {
    console.error("Gazette generation failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
