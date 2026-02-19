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

      for (let i = 0; i < newsletterIds.length; i++) {
        const nlId = newsletterIds[i];
        try {
          const newsletter = await db.query.newsletters.findFirst({
            where: eq(schema.newsletters.id, nlId),
          });

          if (!newsletter) continue;

          // Add delay between API calls for rate limiting (skip first)
          if (i > 0) await new Promise((r) => setTimeout(r, 2000));

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

          send({
            type: "article",
            article: {
              ...article,
              sender: newsletter.sender,
              rawHtml: newsletter.rawHtml,
              receivedAt: newsletter.receivedAt,
            },
            progress: { current: i + 1, total: newsletterIds.length },
          });
        } catch (err) {
          console.error(`Failed to summarize newsletter ${nlId}:`, err);
          send({
            type: "error",
            newsletterId: nlId,
            progress: { current: i + 1, total: newsletterIds.length },
          });
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
