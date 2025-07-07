"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useState } from "react";
import { getEssays } from "@/lib/actions/essays";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Essay = {
  id: string;
  title: string;
  url: string;
  createdAt: Date;
  updatedAt: Date;
};

export default function Chat() {
  const [essays, setEssays] = useState<Essay[]>([]);
  const [selectedEssay, setSelectedEssay] = useState<string>(""); // Store essay ID

  useEffect(() => {
    async function fetchEssays() {
      const fetchedEssays = await getEssays();
      setEssays(fetchedEssays);
    }
    fetchEssays();
  }, []);

  const { messages, input, handleInputChange, handleSubmit } = useChat({
    maxSteps: 3,
  });

  return (
    <div className="flex flex-col w-full max-w-2xl py-12 mx-auto px-4">
      <div className="mb-8">
        <label
          htmlFor="essay-select"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Chat Mode:
        </label>
        <select
          id="essay-select"
          value={selectedEssay}
          onChange={(e) => setSelectedEssay(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">General Q&A (All Essays)</option>
          {essays.map((essay) => (
            <option key={essay.id} value={essay.id}>
              {essay.title}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-6">
        {messages.length > 0 ? (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-x-4 ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {m.role === "assistant" && (
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-600">
                  PG
                </div>
              )}
              <div
                className={`prose p-4 rounded-lg max-w-lg shadow-md ${
                  m.role === "user"
                    ? "bg-blue-500 text-white prose-invert"
                    : "bg-white text-gray-900"
                }`}
              >
                {m.parts.map((part, i) => {
                  if (part.type === "text") {
                    return (
                      <ReactMarkdown key={i} remarkPlugins={[remarkGfm]}>
                        {part.text}
                      </ReactMarkdown>
                    );
                  }
                  if (part.type === "tool-invocation") {
                    const { toolName, args } = part.toolInvocation;

                    if (toolName === "getInformation") {
                      return (
                        <div key={i} className="italic text-gray-500">
                          {`Searching for: "${
                            (args as { question: string }).question
                          }"...`}
                        </div>
                      );
                    }
                    if (toolName === "getEssayContent") {
                      return (
                        <div key={i} className="italic text-gray-500">
                          Preparing summary...
                        </div>
                      );
                    }

                    // Fallback for other tools
                    return (
                      <div key={i} className="italic text-gray-500">
                        {`Calling tool: ${toolName}(${JSON.stringify(args)})`}
                      </div>
                    );
                  }
                })}
              </div>
              {m.role === "user" && (
                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center font-bold text-white">
                  U
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center text-gray-500">
            Ask a question about startups, building products, or finding
            co-founders.
          </div>
        )}
      </div>

      <form
        onSubmit={(e) =>
          handleSubmit(e, {
            data: {
              essayId: selectedEssay,
            },
          })
        }
        className="mt-8"
      >
        <input
          className="fixed bottom-0 w-full max-w-2xl p-4 mb-8 border border-gray-300 rounded-full shadow-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
          value={input}
          placeholder="e.g., How do I find a co-founder?"
          onChange={handleInputChange}
        />
      </form>
    </div>
  );
}
