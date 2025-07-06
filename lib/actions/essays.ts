"use server";

import { db } from "@/lib/db";
import { essaysTable } from "@/lib/db/schema/essaysTable";
import { resourcesTable } from "@/lib/db/schema/resourcesTable";
import { asc, eq } from "drizzle-orm";

export async function getEssays() {
  const essays = await db
    .select()
    .from(essaysTable)
    .orderBy(asc(essaysTable.createdAt));
  return essays;
}

// this is for providing user the summary of the essay
export async function getEssayContent(essayId: string) {
  const chunks = await db
    .select({ content: resourcesTable.content })
    .from(resourcesTable)
    .where(eq(resourcesTable.essayId, essayId))
    .orderBy(asc(resourcesTable.createdAt));

  // Concatenate the content of all chunks into a single string
  return chunks.map((chunk) => chunk.content).join("\\n\\n");
}
