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

  // Fetch newsletter data for each article (for reading pane)
  const articlesWithContent = await Promise.all(
    articles.map(async (article) => {
      const newsletter = await db.query.newsletters.findFirst({
        where: eq(schema.newsletters.id, article.newsletterId),
      });
      return {
        ...article,
        sender: newsletter?.sender || "",
        rawHtml: newsletter?.rawHtml || "",
        receivedAt: newsletter?.receivedAt || "",
      };
    })
  );

  // Group by category
  const grouped: Record<string, typeof articlesWithContent> = {};
  for (const article of articlesWithContent) {
    if (!grouped[article.category]) grouped[article.category] = [];
    grouped[article.category].push(article);
  }

  return NextResponse.json({ edition, articles: grouped });
}
