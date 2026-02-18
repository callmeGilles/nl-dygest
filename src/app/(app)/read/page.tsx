import { redirect } from "next/navigation";
import { db, schema } from "@/db";

export default async function ReadIndexPage() {
  const latestEdition = await db.query.editions.findFirst({
    orderBy: (editions, { desc }) => [desc(editions.generatedAt)],
  });

  if (latestEdition) {
    redirect(`/read/${latestEdition.id}`);
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="text-center space-y-2">
        <p className="text-lg text-slate-500">No editions yet</p>
        <p className="text-sm text-slate-400">Triage some newsletters first</p>
      </div>
    </div>
  );
}
