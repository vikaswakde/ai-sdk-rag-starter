import { embedMany } from "ai";
import { google } from "@ai-sdk/google";

const embeddingModel = google.textEmbeddingModel("text-embedding-004");

// break the source material into small chunks
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
