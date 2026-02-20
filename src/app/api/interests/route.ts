import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { getAuthenticatedSession } from "@/lib/auth-helpers";
import { eq } from "drizzle-orm";

// GET — fetch user's interests
export async function GET() {
  const auth = await getAuthenticatedSession();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const interests = await db.query.userInterests.findMany({
    where: eq(schema.userInterests.sessionId, auth.session.id),
  });

  return NextResponse.json(interests.map((i) => i.topic));
}

// PUT — replace all interests (used during onboarding)
export async function PUT(request: NextRequest) {
  const auth = await getAuthenticatedSession();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { topics } = await request.json();

  if (!Array.isArray(topics) || topics.length < 3 || topics.length > 8) {
    return NextResponse.json(
      { error: "Provide 3-8 topics" },
      { status: 400 }
    );
  }

  // Delete existing interests
  await db
    .delete(schema.userInterests)
    .where(eq(schema.userInterests.sessionId, auth.session.id));

  // Insert new ones
  const now = new Date().toISOString();
  await db.insert(schema.userInterests).values(
    topics.map((topic: string) => ({
      sessionId: auth.session.id,
      topic: topic.trim(),
      createdAt: now,
    }))
  );

  return NextResponse.json({ success: true });
}
