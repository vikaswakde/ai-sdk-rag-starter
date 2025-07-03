"use server";

import {
  NewResourceParams,
  insertResourceSchema,
  resourcesTable,
} from "@/lib/db/schema/resourcesTable";
import { db } from "@/lib/db";
import { generateEmbeddings } from "@/lib/ai/embedding";
import { embeddingsTable } from "@/lib/db/schema/embeddingsTable";

export const createResource = async (input: NewResourceParams) => {
  try {
    const { content } = insertResourceSchema.parse(input);

    const [resource] = await db
      .insert(resourcesTable)
      .values({ content })
      .returning();

    const embeddings = await generateEmbeddings(content);
    await db.insert(embeddingsTable).values(
      embeddings.map((embedding) => ({
        resourceId: resource.id,
        ...embedding,
      }))
    );

    return "Resource successfully created and embedded";
  } catch (e) {
    if (e instanceof Error)
      return e.message.length > 0 ? e.message : "Error, please try again.";
  }
};
