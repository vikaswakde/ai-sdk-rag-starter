import { embed, embedMany } from "ai";
import { google } from "@ai-sdk/google";
import { and, cosineDistance, desc, eq, gt, sql } from "drizzle-orm";
import { embeddingsTable } from "../db/schema/embeddingsTable";
import { db } from "../db";
import { resourcesTable } from "../db/schema/resourcesTable";

const embeddingModel = google.textEmbeddingModel("text-embedding-004");

// break the source material into small chunks
// TODO: use more advanced chunking method

const generateChunks = (input: string): string[] => {
  return (
    input
      .trim()
      .split(".")
      .filter((i) => i !== "")
      // me applying my big brain lol
      .map((i) => i.trim())
  );
};

// generate embeddings
export const generateEmbeddings = async (
  value: string,
  essayId: string // All resources must belong to an essay now
): Promise<Array<{ embedding: number[]; content: string }>> => {
  const chunks = generateChunks(value);
  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: chunks,
  });

  return embeddings.map((e, i) => ({ embedding: e, content: chunks[i] }));
};

// generate embedding for question asked by user
// TODO: can this be a security loophole ?
export const generateQuestionEmbedding = async (
  value: string
): Promise<number[]> => {
  const input = value.replaceAll("\\n", "");

  const { embedding } = await embed({
    model: embeddingModel,
    value: input,
  });

  return embedding;
};

export const findRelevantContent = async (
  userQuery: string,
  essayId?: string // essayId is optional
) => {
  const userQueryEmbedded = await generateQuestionEmbedding(userQuery);

  const similarity = sql<number>`1 - (${cosineDistance(
    embeddingsTable.embedding,
    userQueryEmbedded
  )})`;

  // If an essayId is provided, run a query with a join and filter
  if (essayId) {
    const similarGuides = await db
      .select({
        name: embeddingsTable.content,
        similarity,
      })
      .from(embeddingsTable)
      .innerJoin(
        resourcesTable,
        eq(embeddingsTable.resourceId, resourcesTable.id)
      )
      .where(and(gt(similarity, 0.55), eq(resourcesTable.essayId, essayId)))
      .orderBy((t) => desc(t.similarity))
      .limit(4);
    return similarGuides;
  }

  // Otherwise, run the general query
  const similarGuides = await db
    .select({
      name: embeddingsTable.content,
      similarity,
    })
    .from(embeddingsTable)
    .where(gt(similarity, 0.6))
    .orderBy((t) => desc(t.similarity))
    .limit(4);

  return similarGuides;
};
