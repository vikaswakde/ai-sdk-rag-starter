import "dotenv/config";
import * as cheerio from "cheerio";
import { db } from "@/lib/db";
import { resourcesTable } from "@/lib/db/schema/resourcesTable";
import { embeddingsTable } from "@/lib/db/schema/embeddingsTable";
import { embed } from "ai";
import { google } from "@ai-sdk/google";

// This script will be responsible for scraping, chunking, embedding, and storing Paul Graham's essays.
// We will build it step-by-step.

const ESSAY_URL = "https://paulgraham.com/start.html";
const CHUNK_SIZE = 1100; // Max characters per chunk

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  // First, split by paragraphs
  const paragraphs = text.split(/\n\s*\n/);

  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim();
    if (trimmedParagraph.length === 0) continue;

    if (trimmedParagraph.length <= CHUNK_SIZE) {
      chunks.push(trimmedParagraph);
    } else {
      // If a paragraph is too long, split it by sentences
      const sentences = trimmedParagraph.split(/(?<=[.?!])\s+/);
      let currentChunk = "";
      for (const sentence of sentences) {
        if (currentChunk.length + sentence.length <= CHUNK_SIZE) {
          currentChunk += sentence + " ";
        } else {
          chunks.push(currentChunk.trim());
          currentChunk = sentence + " ";
        }
      }
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
    }
  }
  return chunks;
}

async function ingestEssay(url: string) {
  try {
    // 1. Scrape and Chunk
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`Failed to fetch essay: ${response.statusText}`);
    const html = await response.text();
    const $ = cheerio.load(html);
    const essayText = $("font").eq(2).text();
    const chunks = chunkText(essayText);

    console.log(`Scraped and chunked essay. Found ${chunks.length} chunks.`);

    // 2. Embed and Store
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`Processing chunk ${i + 1}/${chunks.length}...`);

      // Create embedding
      const { embedding } = await embed({
        model: google.textEmbeddingModel("text-embedding-004"),
        value: chunk,
      });

      // Insert into resources table
      const [resource] = await db
        .insert(resourcesTable)
        .values({ content: chunk })
        .returning({ id: resourcesTable.id });

      // Insert into embeddings table
      await db.insert(embeddingsTable).values({
        resourceId: resource.id,
        content: chunk, // Storing content here for easier debugging
        embedding: embedding,
      });
    }

    console.log("✅ Ingestion complete.");
  } catch (error) {
    console.error("Error during ingestion:", error);
  } finally {
    // Ensure the script exits
    process.exit(0);
  }
}

ingestEssay(ESSAY_URL);
