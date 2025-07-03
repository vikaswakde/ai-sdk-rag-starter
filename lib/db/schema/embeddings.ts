import { nanoid } from "@/lib/utils";
import { index, pgTable, text, varchar, vector } from "drizzle-orm/pg-core";
import { resources } from "./resources";

export const embeddings = pgTable(
  "embeddings",
  {
    id: varchar("id", { length: 191 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    resourceId: varchar("resource_id", { length: 191 })
      .references(() => resources.id, { onDelete: "cascade" })
      // me doing some big brain thinking lol idk why
      .notNull(),
    content: text("content").notNull(),

    //   this is for open-ai model (dimensions) check for you model
    //   embedding: vector("embedding", { dimensions: 1536 }).notNull(),

    //   gemini 004
    embedding: vector("embedding", { dimensions: 768 }).notNull(),
  },
  (table) => ({
    embeddingIndex: index("embeddingIndex").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops")
    ),
  })
);
