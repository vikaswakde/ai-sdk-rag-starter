import "dotenv/config";
import * as cheerio from "cheerio";
import { db } from "@/lib/db";
import { resourcesTable } from "@/lib/db/schema/resourcesTable";
import { embeddingsTable } from "@/lib/db/schema/embeddingsTable";
import { embedMany } from "ai";
import { google } from "@ai-sdk/google";
import { essaysTable } from "@/lib/db/schema/essaysTable";
import { eq } from "drizzle-orm";

// This script will be responsible for scraping, chunking, embedding, and storing Paul Graham's essays.
// We will build it step-by-step.

const ESSAY_URL = "http://www.paulgraham.com/google.html";
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
    // 0. Check if essay already exists. If so, delete its children.
    const existingEssay = await db
      .select({ id: essaysTable.id })
      .from(essaysTable)
      .where(eq(essaysTable.url, url));

    if (existingEssay.length > 0) {
      console.log(
        "Essay already exists. Deleting old entries and re-ingesting."
      );
      await db
        .delete(essaysTable)
        .where(eq(essaysTable.id, existingEssay[0].id));
      // Children in resources and embeddings are deleted automatically by `onDelete: "cascade"`
    }

    // 1. Scrape and Chunk
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`Failed to fetch essay: ${response.statusText}`);
    const html = await response.text();
    const $ = cheerio.load(html);
    const title = $("title").first().text();

    // Find the font tag with the most text, as it's most likely the main content
    let longestText = "";
    $("font").each((i, el) => {
      const currentText = $(el).text();
      if (currentText.length > longestText.length) {
        longestText = currentText;
      }
    });
    const essayText = longestText;

    console.log("--- SCRAPED RAW TEXT ---");
    console.log(essayText);
    console.log("--- END RAW TEXT ---");

    const chunks = chunkText(essayText);

    if (chunks.length === 0) {
      console.log("Could not find content for this essay, skipping.");
      return;
    }

    console.log(
      `Scraped and chunked '${title}'. Found ${chunks.length} chunks.`
    );

    // 2. Create parent essay entry in the DB
    const [essay] = await db
      .insert(essaysTable)
      .values({ title, url })
      .returning({ id: essaysTable.id });

    console.log(`Created essay entry with ID: ${essay.id}`);

    // 3. Embed all chunks in a single batch
    const { embeddings } = await embedMany({
      model: google.textEmbeddingModel("text-embedding-004"),
      values: chunks,
    });

    console.log(`Generated ${embeddings.length} embeddings.`);

    // 4. Create resource and embedding entries for each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings[i];

      const [resource] = await db
        .insert(resourcesTable)
        .values({
          essayId: essay.id,
          content: chunk,
        })
        .returning({ id: resourcesTable.id });

      await db.insert(embeddingsTable).values({
        resourceId: resource.id,
        content: chunk,
        embedding: embedding,
      });
    }

    console.log("✅ Ingestion complete for:", url);
  } catch (error) {
    console.error(`Error during ingestion for ${url}:`, error);
  }
}

// --- Main execution ---

(async () => {
  await ingestEssay(ESSAY_URL);
  process.exit(0);
})();
