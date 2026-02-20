import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { getAuthenticatedSession } from "@/lib/auth-helpers";
import { fetchNewsletters } from "@/lib/newsletters";
import {
  generateGazette,
  prepareCandidates,
} from "@/lib/gazette-generator";

export async function POST() {
  try {
    const auth = await getAuthenticatedSession();
    if (!auth?.tokens) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Check if gazette already exists for today
    const today = new Date().toISOString().split("T")[0];
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

    // Get user's labels (multi-label support)
    const prefs = auth.preferences;
    let labels: string[] = ["Newsletters"];
    if (prefs?.gmailLabels) {
      try {
        labels = JSON.parse(prefs.gmailLabels);
      } catch {
        labels = [prefs.gmailLabel || "Newsletters"];
      }
    } else if (prefs?.gmailLabel) {
      labels = [prefs.gmailLabel];
    }

    // Fetch newsletters from all selected labels
    const allGmailNewsletters = [];
    for (const label of labels) {
      const newsletters = await fetchNewsletters(
        label,
        50,
        auth.tokens.accessToken,
        auth.tokens.refreshToken
      );
      allGmailNewsletters.push(...newsletters);
    }

    // Deduplicate by gmailId
    const seen = new Set<string>();
    const uniqueNewsletters = allGmailNewsletters.filter((nl) => {
      if (seen.has(nl.gmailId)) return false;
      seen.add(nl.gmailId);
      return true;
    });

    // Store new newsletters in DB
    for (const nl of uniqueNewsletters) {
      const existing = await db.query.newsletters.findFirst({
        where: eq(schema.newsletters.gmailId, nl.gmailId),
      });
      if (!existing) {
        await db.insert(schema.newsletters).values(nl);
      }
    }

    // Get all newsletters not yet in any edition
    const existingArticles = await db.query.editionArticles.findMany();
    const processedNlIds = new Set(existingArticles.map((a) => a.newsletterId));

    const allNewsletters = await db.query.newsletters.findMany({
      orderBy: (newsletters, { desc }) => [desc(newsletters.receivedAt)],
    });
    const available = allNewsletters.filter((nl) => !processedNlIds.has(nl.id));

    if (available.length === 0) {
      return NextResponse.json(
        { error: "No unread newsletters available" },
        { status: 400 }
      );
    }

    // Get user interests
    const interests = await db.query.userInterests.findMany({
      where: eq(schema.userInterests.sessionId, auth.session.id),
    });
    const interestTopics = interests.map((i) => i.topic);

    // Prepare candidates and generate gazette
    const candidates = prepareCandidates(available);
    const gazette = await generateGazette(
      candidates,
      interestTopics.length > 0 ? interestTopics : ["General"]
    );

    // Create edition
    const [edition] = await db
      .insert(schema.editions)
      .values({ generatedAt: new Date().toISOString() })
      .returning();

    // Estimate reading time from newsletter content (~225 words/min)
    const estimateReadingTime = (newsletterId: number): number => {
      const nl = allNewsletters.find((n) => n.id === newsletterId);
      if (!nl) return 3;
      const wordCount = nl.rawHtml.replace(/<[^>]+>/g, " ").split(/\s+/).length;
      return Math.max(1, Math.round(wordCount / 225));
    };

    // Store gazette articles
    const storeArticle = async (
      newsletterId: number,
      category: string,
      section: string,
      position: number,
      headline: string,
      summary: string,
      keyPoints: string[],
      expandedSummary: string | null
    ) => {
      await db.insert(schema.editionArticles).values({
        editionId: edition.id,
        newsletterId,
        category,
        section,
        position,
        headline,
        summary,
        keyPoints: JSON.stringify(keyPoints),
        expandedSummary,
        readingTime: estimateReadingTime(newsletterId),
      });
    };

    // Store headline
    await storeArticle(
      gazette.headline.newsletterId,
      gazette.headline.interestTag,
      "headline",
      0,
      gazette.headline.title,
      gazette.headline.summary,
      gazette.headline.takeaways,
      null
    );

    // Store worth your time
    for (let i = 0; i < gazette.worthYourTime.length; i++) {
      const item = gazette.worthYourTime[i];
      await storeArticle(
        item.newsletterId,
        item.interestTag,
        "worth_your_time",
        i,
        item.hook,
        item.hook,
        item.takeaways,
        item.expandedSummary
      );
    }

    // Store in brief
    for (let i = 0; i < gazette.inBrief.length; i++) {
      const item = gazette.inBrief[i];
      await storeArticle(
        item.newsletterId,
        item.interestTag,
        "in_brief",
        i,
        item.oneLiner,
        item.oneLiner,
        [],
        item.expandedSummary
      );
    }

    return NextResponse.json({
      editionId: edition.id,
      status: "ready",
    });
  } catch (error) {
    console.error("Gazette generation failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
