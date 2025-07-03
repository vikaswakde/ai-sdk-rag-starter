import { embed, embedMany } from "ai";
import { google } from "@ai-sdk/google";
import { cosineDistance, desc, gt, sql } from "drizzle-orm";
import { embeddingsTable } from "../db/schema/embeddingsTable";
import { db } from "../db";

const embeddingModel = google.textEmbeddingModel("text-embedding-004");

// break the source material into small chunks
/* 
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
*/

// advanced chunking method (advised by claude 3.7)
const generateChunks = (
  input: string,
  chunkSize = 768,
  overlapSize = 150
): string[] => {
  const paragraphs = input.split(/\n\s*\n/).filter((p) => p.trim());
  const chunks: string[] = [];

  paragraphs.forEach((paragraph) => {
    if (paragraph.length <= chunkSize) {
      chunks.push(paragraph.trim());
      return;
    }

    let startIndex = 0;
    while (startIndex < paragraph.length) {
      let endIndex = Math.min(startIndex + chunkSize, paragraph.length);

      if (endIndex < paragraph.length) {
        const sentenceEnd = paragraph
          .substring(startIndex, endIndex + 50)
          .search(/[.!?]\s/);
        if (sentenceEnd > 0) {
          endIndex = startIndex + sentenceEnd + 1;
        }
      }

      chunks.push(paragraph.substring(startIndex, endIndex).trim());
      startIndex = endIndex - overlapSize;
    }
  });

  return chunks.filter((chunk) => chunk.length > 0);
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
