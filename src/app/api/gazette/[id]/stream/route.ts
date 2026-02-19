import { NextRequest } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { summarizeNewsletter } from "@/lib/summarize";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const editionId = parseInt(id);

  // Get newsletter IDs from query params
  const newsletterIdsParam = request.nextUrl.searchParams.get("newsletterIds");
  if (!newsletterIdsParam) {
    return new Response("Missing newsletterIds", { status: 400 });
  }
  const newsletterIds = newsletterIdsParam.split(",").map(Number);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Process newsletters in batches of 3 for parallelism
      const BATCH_SIZE = 3;
      const BATCH_DELAY = 500;
      let completed = 0;

      for (let batchStart = 0; batchStart < newsletterIds.length; batchStart += BATCH_SIZE) {
        const batch = newsletterIds.slice(batchStart, batchStart + BATCH_SIZE);

        // Add delay between batches (skip first)
        if (batchStart > 0) await new Promise((r) => setTimeout(r, BATCH_DELAY));

        const results = await Promise.allSettled(
          batch.map(async (nlId) => {
            const newsletter = await db.query.newsletters.findFirst({
              where: eq(schema.newsletters.id, nlId),
            });
            if (!newsletter) return null;

            const summary = await summarizeNewsletter(newsletter.rawHtml);

            const [article] = await db
              .insert(schema.editionArticles)
              .values({
                editionId,
                newsletterId: newsletter.id,
                category: summary.category,
                headline: summary.headline,
                summary: summary.summary,
                keyPoints: JSON.stringify(summary.key_points),
                readingTime: summary.reading_time,
              })
              .returning();

            return {
              ...article,
              sender: newsletter.sender,
              rawHtml: newsletter.rawHtml,
              receivedAt: newsletter.receivedAt,
            };
          })
        );

        for (const result of results) {
          completed++;
          if (result.status === "fulfilled" && result.value) {
            send({
              type: "article",
              article: result.value,
              progress: { current: completed, total: newsletterIds.length },
            });
          } else {
            console.error(`Failed to summarize newsletter in batch:`, result.status === "rejected" ? result.reason : "not found");
            send({
              type: "error",
              progress: { current: completed, total: newsletterIds.length },
            });
          }
        }
      }

      send({ type: "complete" });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
