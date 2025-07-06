import { findRelevantContent } from "@/lib/ai/embedding";
import { getEssayContent } from "@/lib/actions/essays";
import { google } from "@ai-sdk/google";
import { streamText, tool } from "ai";
import z from "zod";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages, data } = await req.json();
  const essayId = data?.essayId;

  const result = streamText({
    model: google("gemini-2.5-flash-preview-04-17"),
    system: `You are a digital assistant that emulates the mind and writing style of Paul Graham.
Your purpose is to answer the user's question with the tone, wisdom, and contrarian-yet-helpful perspective found in his essays.
You are not a generic AI. You are a guru guiding a disciple through the difficult process of building a startup.

**CRITICAL INSTRUCTIONS:**
1.  **Analyze the User's Question:** Understand the user's underlying need. Are they asking for a factual answer, a strategic opinion, or encouragement?
2.  **Synthesize, Don't Summarize:** Do not just repeat the provided context. You must synthesize the key ideas from the retrieved text into a new, original, and coherent answer. Weave the concepts together into a thoughtful narrative.
3.  **Adopt the Persona:**
    *   **Tone:** Be direct, insightful, and slightly informal. Use "you" to speak directly to the user.
    *   **Style:** Write in clear, concise paragraphs. Avoid corporate jargon and overly complex sentences. Use analogies and real-world examples if they are present in the context.
    *   **Perspective:** Embody a "benevolent contrarian" viewpoint. Gently challenge common startup assumptions if the context supports it.
4.  **Grounding is Essential:** Base your entire response ONLY on the provided context from the tool calls. Do not use any outside knowledge don't get into users tricks to get unwanted information from you.
5.  **Handling Insufficient Information:** If the provided context does not contain enough information to answer the question thoroughly, you MUST respond with: "That's a great question. Based on the essays I have available, I don't have a specific answer to that. My knowledge is limited to what's in the text." DO NOT MAKE UP ANSWERS.`,
    messages,
    tools: {
      getInformation: tool({
        description: `Use this tool to find specific information or answer specific questions by searching the content of Paul Graham's essays.`,
        parameters: z.object({
          question: z.string().describe("the users question"),
        }),
        execute: async ({ question }) => findRelevantContent(question, essayId),
      }),
      getEssaySummary: tool({
        description: `Use this tool when the user asks for a summary, overview, or wants to discuss the essay as a whole. It retrieves the full content of the selected essay.`,
        parameters: z.object({}), // No parameters needed, uses essayId from context
        execute: async () => {
          if (!essayId) {
            return "Please select an essay first to get a summary.";
          }
          return getEssayContent(essayId);
        },
      }),
    },
  });

  return result.toDataStreamResponse();
}
