import { embed, embedMany } from "ai";
import { google } from "@ai-sdk/google";
import { cosineDistance, desc, gt, sql } from "drizzle-orm";
import { embeddingsTable } from "../db/schema/embeddingsTable";
import { db } from "../db";

const embeddingModel = google.textEmbeddingModel("text-embedding-004");

// break the source material into small chunks
// TODO: use more advanced chunking method

const generateChunks = (input: string): string[] => {
  return (
    input
      .trim()
      .split(".")
      .filter((i) => i !== "")
      // me applyig my big brain lol
      .map((i) => i.trim())
  );
};

// generate embeddings
export const generateEmbeddings = async (
  value: string
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

export const findRelevantContent = async (userQuery: string) => {
  const userQueryEmbedded = await generateQuestionEmbedding(userQuery);

  const similarity = sql<number>`1 - (${cosineDistance(
    embeddingsTable.embedding,
    userQueryEmbedded
  )})`;

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
